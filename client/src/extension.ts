/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import * as vscode from "vscode";
import * as fs from 'fs';
import { workspace, ExtensionContext, languages, commands, Uri } from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';

import { HyperlanePermissionlessDeployer } from "./hyperlane/src/core/HyperlanePermissionlessDeployer";
import { ethers } from 'ethers';
import { MultiProvider, chainIdToMetadata } from '@hyperlane-xyz/sdk';
import { getMultiProvider } from './hyperlane/src/config';
import { readJSON } from './hyperlane/src/json';

let client: LanguageClient;

export async function activate(context: ExtensionContext) {
	// The server is implemented in node
	const serverModule = context.asAbsolutePath(
		path.join('server', 'out', 'server.js')
	);

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
		}
	};

	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [{ scheme: 'file', pattern: '**/*.{ts,js}' }],
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		}
	};

	// Create the language client and start the client.
	client = new LanguageClient(
		'hyperlane',
		'Hyperlane VS Code',
		serverOptions,
		clientOptions,
	);

	commands.registerCommand("deploy.hyperlane", async (chainId: string) => {
		let out = vscode.window.createOutputChannel("Hyperlane VS Code");

		out.appendLine(`Deploying Hyperlane to chain ID ${chainId}...`);

		let logger = (msg: string) => {
			out.appendLine(msg);
		};

		const configDir = workspace.getConfiguration().get('hyperlane.configDir') as string | undefined;
		const privateKey = workspace.getConfiguration().get('hyperlane.privateKey') as string | undefined;
	
		if (!configDir) {
			throw new Error("Set hyperlane.configDir in your VS Code settings under the Hyperlane extension");
		}
		if (!privateKey) {
			throw new Error("Set hyperlane.privateKey in your VS Code settings under the Hyperlane extension");
		}
		// if chains.json doesn't exist
		assertConfigFilesExist(configDir);
	

		const multiProvider = await getMultiProvider(configDir);
		const signer = new ethers.Wallet(privateKey);
		multiProvider.setSharedSigner(signer);


		logger(`Using config dir ${configDir}`);

		const { local, remotes } = getLocalsAndRemotes(chainId, out, configDir);

		const deployer = new HyperlanePermissionlessDeployer(
			multiProvider,
			signer,
			local,
			remotes,
			true,
			logger,
			configDir
		);
		vscode.window.showInformationMessage(`Deploying Hyperlane to chain ID ${chainId}...`);
		await deployer.deploy();
		vscode.window.showInformationMessage(`🚀 Hyperlane deployed to ${local} with remotes ${remotes}!`);
		client.sendNotification('workspace/didChangeConfiguration');
	});

	const generateConfigCommand = commands.registerCommand("hyperlane.generate.sample.config", async () => {
		const configDir = workspace.getConfiguration().get('hyperlane.configDir') as string | undefined;
		if (!configDir) {
			throw new Error("Set configDir in your VS Code settings under the Hyperlane extension");
		}
		fs.writeFileSync(path.join(configDir, 'chains.json'), chainsJsonSample);
		fs.writeFileSync(path.join(configDir, 'multisig_ism.json'), multisigJsonSample);
		vscode.window.showInformationMessage(`Generated sample config files in ${configDir}`);
		client.sendNotification('workspace/didChangeConfiguration'); // refresh
	});
	context.subscriptions.push(generateConfigCommand);

	commands.registerCommand("hyperlane.configure", () => {
		commands.executeCommand("vscode.open", "http://www.google.com");
		const configDir = workspace.getConfiguration().get('hyperlane.configDir') as string | undefined;
		if (!configDir) {
			vscode.window.showInformationMessage("Set configDir in your VS Code settings under the Hyperlane extension to the folder where you downloaded the config file");			
		} else {
			vscode.window.showInformationMessage(`NOTE: Copy the downloaded config file to ${configDir} and refresh`);
		}
	})

	// Start the client. This will also launch the server
	client.start();
}

function assertConfigFilesExist(configDir: string) {
	if (!fs.existsSync(path.join(configDir, 'chains.json')) || !fs.existsSync(path.join(configDir, 'multisig_ism.json'))) {
		throw new Error(`Missing config in ${configDir}. Right-click and select "Generate Sample Config" to generate sample Hyperlane config.`);
	}
}

function getLocalsAndRemotes(chainId: string, out: any, configDir: string) {
	const chains = readJSON(configDir, 'chains.json') as any;

	let local = undefined;
	const remotes = [];
	for (const [name, chainInfo] of Object.entries(chains)) {
		if ((chainInfo as any).chainId == chainId) {
			out.appendLine(`Found local chain ${name}`);
			local = name;
		} else {
			out.appendLine(`Found remote chain ${name}`);
			remotes.push(name);
		}
	}
	if (!local) {
		throw new Error(`Could not find chain with chain ID ${chainId} in ${configDir}/chains.json`);
	}
	return { local, remotes };
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}

const chainsJsonSample = `\
{
  "anvil1": {
    "name": "anvil1",
    "chainId": 31337,
    "nativeToken": {
      "name": "ether",
      "symbol": "ETH",
      "decimals": 18
    },
    "publicRpcUrls": [
      {
        "http": "http://127.0.0.1:8545"
      }
    ]
  },
  "anvil2": {
    "name": "anvil2",
    "chainId": 31338,
    "publicRpcUrls": [
      {
        "http": "http://127.0.0.1:8555"
      }
    ]
  }
}`;

const multisigJsonSample = `\
{
  "anvil1": {
    "threshold": 1,
    "validators": [
      "0xa0ee7a142d267c1f36714e4a8f75612f20a79720"
    ]
  },
  "anvil2": {
    "threshold": 1,
    "validators": [
      "0xa0ee7a142d267c1f36714e4a8f75612f20a79720"
    ]
  }
}`;