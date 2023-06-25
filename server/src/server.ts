/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
	createConnection,
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult,
	HoverParams,
	Hover,
	CodeActionKind,
	CodeAction,
	CodeActionContext,
	CodeActionParams,
	WorkspaceEdit,
} from 'vscode-languageserver/node';

import {
	Range,
	TextDocument
} from 'vscode-languageserver-textdocument';

import * as fs from 'fs';
import * as path from 'path';

import { chainIdToMetadata } from '@hyperlane-xyz/sdk/dist/consts/chainMetadata';

const DIAGNOSTIC_TYPE_DEPLOY_TO_CHAIN = 'DeployToChain';
const DIAGNOSTIC_TYPE_CONFIG_NOT_FOUND = 'ConfigNotFound';

const DEPLOY_COMMAND = 'deploy.hyperlane';
const GENERATE_SAMPLE_CONFIG_COMMAND = 'hyperlane.generate.sample.config';
const CONFIGURE_HYPERLANE_COMMAND = 'hyperlane.configure';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params: InitializeParams) => {
	const capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we fall back using global settings.
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			hoverProvider : {
				workDoneProgress: false
			},
			codeActionProvider : {
				codeActionKinds : [ CodeActionKind.QuickFix ],
			},
		}
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}
	return result;
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

interface HyperlaneVSCodeSettings {
	maxNumberOfProblems: number;
	configDir?: string;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: HyperlaneVSCodeSettings = { maxNumberOfProblems: 1000, configDir: undefined };
let globalSettings: HyperlaneVSCodeSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<HyperlaneVSCodeSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <HyperlaneVSCodeSettings>(
			(change.settings.hyperlane || defaultSettings)
		);
	}

	// Revalidate all open text documents
	documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<HyperlaneVSCodeSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'hyperlane'
		});
		documentSettings.set(resource, result);
	}
	return result;
}

// Only keep settings for open documents
documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
	validateTextDocument(change.document);
});

function initializeAddressesJson(settings: HyperlaneVSCodeSettings) {
	// check if file at (path.join(configDir, 'artifacts'), 'addresses.json') exists
	if (settings.configDir !== undefined) {
		const artifactsDir = path.join(settings.configDir, 'artifacts');
		if (!fs.existsSync(path.join(artifactsDir, 'addresses.json'))) {
			// if not, create it
			fs.mkdirSync(artifactsDir, { recursive: true });
			fs.writeFileSync(path.join(artifactsDir, 'addresses.json'), '{}');
		}
	}
}

async function validateTextDocument(textDocument: TextDocument): Promise<void> {

	// In this simple example we get the settings for every validate run.
	const settings = await getDocumentSettings(textDocument.uri);

	initializeAddressesJson(settings);


	// The validator creates diagnostics for detected patterns
	const text = textDocument.getText();

	// regex that looks for "chainId: '<any number>'," in text, where quotes are optional, and grabs the number
	const pattern = /chainId\s*:\s*['"]?(\d+)['"]?\s*/g;
	let m: RegExpExecArray | null;

	let problems = 0;
	const diagnostics: Diagnostic[] = [];
	while ((m = pattern.exec(text)) && problems < settings.maxNumberOfProblems) {
		problems++;

		const chainId = m[1];
		const metadata = chainIdToMetadata[chainId];
		if (metadata !== undefined) {
			// chainId is valid
			const diagnostic: Diagnostic = {
				severity: DiagnosticSeverity.Information,
				range: {
					start: textDocument.positionAt(m.index),
					end: textDocument.positionAt(m.index + m[0].length)
				},
				message: `🚀🚀🚀 ${metadata.displayName ?? metadata.name} network is ready to use on Hyperlane! 🚀🚀🚀`,
			};
			diagnostics.push(diagnostic);
		} else {
			const deployedAddresses = settings.configDir ? getDeployedAddresses(chainId, settings.configDir) : undefined;
			if (deployedAddresses !== undefined && deployedAddresses.mailbox !== undefined && deployedAddresses.multisigIsm !== undefined && deployedAddresses.interchainGasPaymaster !== undefined) {
				const diagnostic: Diagnostic = {
					severity: DiagnosticSeverity.Information,
					range: {
						start: textDocument.positionAt(m.index),
						end: textDocument.positionAt(m.index + m[0].length)
					},
					message: `\
🚀🚀🚀 ${deployedAddresses.name} network is ready to use on Hyperlane! 🚀🚀🚀
📬 Mailbox: ${deployedAddresses.mailbox}
🔐 Multisig ISM: ${deployedAddresses.multisigIsm}
⛽ IGP: ${deployedAddresses.interchainGasPaymaster}`,
				};
				diagnostics.push(diagnostic);
			} else {
				// if config files don't exist
				const configDir = settings.configDir;
				if (configDir !== undefined && (!fs.existsSync(path.join(configDir, 'chains.json')) || !fs.existsSync(path.join(configDir, 'multisig_ism.json')))) {
					const diagnostic: Diagnostic = {
						severity: DiagnosticSeverity.Warning,
						range: {
							start: textDocument.positionAt(m.index),
							end: textDocument.positionAt(m.index + m[0].length)
						},
						message: `Chain ID ${chainId} is not yet supported by Hyperlane and config not found. 🪄✨ Generate or configure? ✨🪄`,
						code: DIAGNOSTIC_TYPE_CONFIG_NOT_FOUND,
					}
					diagnostics.push(diagnostic);
				} else {
					// else offer to deploy to the chain
					const diagnostic: Diagnostic = {
						severity: DiagnosticSeverity.Warning,
						range: {
							start: textDocument.positionAt(m.index),
							end: textDocument.positionAt(m.index + m[0].length)
						},
						message: `Chain ID ${chainId} is not yet supported by Hyperlane. 🪄✨ Deploy Hyperlane to chain? ✨🪄`,
						code: DIAGNOSTIC_TYPE_DEPLOY_TO_CHAIN + chainId,
					}
					diagnostics.push(diagnostic);
					}

			}
		}
				
	}

	// Send the computed diagnostics to VSCode.
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

interface Addresses {
	name: string;
	mailbox: string;
	multisigIsm: string;
	interchainGasPaymaster: string;
}

function getDeployedAddresses(chainId: string, configDir: string) : Addresses | undefined {
	// get name from chains.json
	try {
		const chains = readJSON(configDir, 'chains.json') as any;
		for (const [name, chainInfo] of Object.entries(chains)) {
			if ((chainInfo as any).chainId == chainId) {
				// check if name is in addresses.json
				const addresses = readJSON(path.join(configDir, 'artifacts'), 'addresses.json') as any;
				if (addresses[name] !== undefined) {
					return {
						name,
						...addresses[name],
					};
				}
			}
		}
	} catch (e) {
		connection.console.error(`Error reading chains.json or addresses.json: ${e}`);
	}
}

//=== from hyperlane json.ts ===


export function readFileAtPath(filepath: string) {
  if (!fs.existsSync(filepath)) {
    throw Error(`file doesn't exist at ${filepath}`);
  }
  return fs.readFileSync(filepath, 'utf8');
}

export function readJSONAtPath<T>(filepath: string): T {
  return JSON.parse(readFileAtPath(filepath)) as T;
}

export function readJSON<T>(directory: string, filename: string): T {
  return readJSONAtPath(path.join(directory, filename));
}
//=== end from hyperlane json.ts ===

connection.onCodeAction(
	async (_params: CodeActionParams): Promise<CodeAction[]> => {
		let codeActions : CodeAction[] = [];

		let textDocument = documents.get(_params.textDocument.uri)
		if (textDocument === undefined) {
			return codeActions;
		}
		let context : CodeActionContext = _params.context;
		let diagnostics : Diagnostic[] = context.diagnostics;

		codeActions = await getCodeActions(diagnostics, textDocument, _params);

		return codeActions;
	}
);

async function getCodeActions(diagnostics: Diagnostic[], textDocument: TextDocument, params: CodeActionParams) : Promise<CodeAction[]> {
	let codeActions : CodeAction[] = [];

	// Get quick fixes for each diagnostic
	for (let i = 0; i < diagnostics.length; i++) {

		let diagnostic = diagnostics[i];
		if (String(diagnostic.code).startsWith(DIAGNOSTIC_TYPE_DEPLOY_TO_CHAIN)) {
			let title : string = "Deploy Hyperlane to chain";
			const chainId = String(diagnostic.code).replace(DIAGNOSTIC_TYPE_DEPLOY_TO_CHAIN, "");
			codeActions.push(getDeployAction(diagnostic, title, chainId));
		} else if (String(diagnostic.code) === DIAGNOSTIC_TYPE_CONFIG_NOT_FOUND) {
			codeActions.push(getGenerateAction(diagnostic, "Generate sample config", ""));
			codeActions.push(getConfigureAction(diagnostic, "Configure Hyperlane deployment", ""));
		}
	}

	return codeActions;
}

function getDeployAction(diagnostic:Diagnostic, title:string, chainId:string) : CodeAction {
	let codeAction : CodeAction = { 
		title: title, 
		kind: CodeActionKind.QuickFix,
		command: {
			title: title,
			command: DEPLOY_COMMAND,
			arguments: [chainId]
		},
		diagnostics: [diagnostic]
	}
	return codeAction;
}

function getGenerateAction(diagnostic:Diagnostic, title:string, chainId:string) : CodeAction {
	let codeAction : CodeAction = { 
		title: title, 
		kind: CodeActionKind.QuickFix,
		command: {
			title: title,
			command: GENERATE_SAMPLE_CONFIG_COMMAND,
		},
		diagnostics: [diagnostic]
	}
	return codeAction;
}

function getConfigureAction(diagnostic:Diagnostic, title:string, chainId:string) : CodeAction {
	let codeAction : CodeAction = { 
		title: title, 
		kind: CodeActionKind.QuickFix,
		command: {
			title: title,
			command: CONFIGURE_HYPERLANE_COMMAND,
		},
		diagnostics: [diagnostic]
	}
	return codeAction;
}

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
});

connection.onHover(

	async (_params: HoverParams): Promise<Hover> => {
		let textDocument = documents.get(_params.textDocument.uri)
		let position = _params.position
		let hover : Hover = {
			contents: '',
		}
		if (textDocument !== undefined) {
			var start = {
				line: position.line,
				character: 0,
			};
			var end = {
				line: position.line + 1,
				character: 0,
			};
			var text = textDocument.getText({ start, end });

			// connection.console.log(text);

			const chainId = getChainIdFromLine(text);
			const metadata = chainId ? chainIdToMetadata[chainId] : undefined;

			if (metadata !== undefined) {
				// connection.console.log(JSON.stringify(metadata, null, 2));
				hover.contents = JSON.stringify(metadata, null, 2);

				hover.contents = `\
**Chain ID**: ${chainId}\n
**Network**: ${metadata.displayName ?? metadata.name}\n
`;

        if (metadata.nativeToken !== undefined) {
					hover.contents += `**Native Token**: ${metadata.nativeToken.name} (${metadata.nativeToken.symbol})\n\n`
				}

				if (metadata.blockExplorers !== undefined && metadata.blockExplorers.length > 0) {
					hover.contents += `**Block Explorers**: ` + 
						metadata.blockExplorers.map((blockExplorer) => {
							return `[${blockExplorer.name}](${blockExplorer.url})`
						}).join(', ');
				}

				hover.contents += `\n\n
**RPCs**: \n\n
${metadata.publicRpcUrls.map((rpcUrl) => {
	return `- ${rpcUrl.http}`
}).join('\n\n')}
\n\n`;
			}

		}
		return hover;
	}
	
);

function getChainIdFromLine(text: string): string | undefined {
	if (text.trim().startsWith('chainId:')) {
		let chainId = text.trim().split(':')[1].trim();
		// remove comma
		chainId = chainId.replace(',', '');
		// remove any surrounding quotes
		chainId = chainId.replace(/['"]+/g, '');
		return chainId;
	}
}

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
