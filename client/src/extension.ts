/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import * as vscode from "vscode";
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

		const multiProvider = await getMultiProvider(configDir);
		const signer = new ethers.Wallet(privateKey);
		multiProvider.setSharedSigner(signer);


		logger(`Using config dir ${configDir}`);


		const deployer = new HyperlanePermissionlessDeployer(
			multiProvider,
			signer,
			'anvil1',
			['anvil2'],
			false,
			logger,
			configDir
		);
		await deployer.deploy();
	});

	// Start the client. This will also launch the server
	client.start();
}



export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}
