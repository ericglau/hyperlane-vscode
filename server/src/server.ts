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
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

import { chainIdToMetadata } from '@hyperlane-xyz/sdk/dist/consts/chainMetadata';

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
			// Tell the client that this server supports code completion.
			completionProvider: {
				resolveProvider: true
			},
			hoverProvider : {
				workDoneProgress: false
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

// The example settings
interface ExampleSettings {
	maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
let globalSettings: ExampleSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <ExampleSettings>(
			(change.settings.languageServerExample || defaultSettings)
		);
	}

	// Revalidate all open text documents
	documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'languageServerExample'
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

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
	// In this simple example we get the settings for every validate run.
	const settings = await getDocumentSettings(textDocument.uri);

	// The validator creates diagnostics for detected patterns
	const text = textDocument.getText();

	// regex that looks for "chainId: '<any number>'," in text, where quotes are optional, and grabs the number
	const pattern = /chainId\s*:\s*['"]?(\d+)['"]?\s*,/g;
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
			// offer to deploy to the chain
			const diagnostic: Diagnostic = {
				severity: DiagnosticSeverity.Error,
				range: {
					start: textDocument.positionAt(m.index),
					end: textDocument.positionAt(m.index + m[0].length)
				},
				message: `Chain ID ${chainId} is not yet supported by Hyperlane. 🪄✨ Deploy and make it available? ✨🪄`,
			}
			diagnostics.push(diagnostic);
		}
				
	}

	// Send the computed diagnostics to VSCode.
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VSCode
	connection.console.log('We received an file change event');
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
	(_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
		// The pass parameter contains the position of the text document in
		// which code complete got requested. For the example we ignore this
		// info and always provide the same completion items.
		return [
			{
				label: 'TypeScript',
				kind: CompletionItemKind.Text,
				data: 1
			},
			{
				label: 'JavaScript',
				kind: CompletionItemKind.Text,
				data: 2
			}
		];
	}
);

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

			connection.console.log(text);

			const chainId = getChainIdFromLine(text);
			const metadata = chainId ? chainIdToMetadata[chainId] : undefined;

			if (metadata !== undefined) {
				connection.console.log(JSON.stringify(metadata, null, 2));
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

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		if (item.data === 1) {
			item.detail = 'TypeScript details';
			item.documentation = 'TypeScript documentation';
		} else if (item.data === 2) {
			item.detail = 'JavaScript details';
			item.documentation = 'JavaScript documentation';
		}
		return item;
	}
);

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
