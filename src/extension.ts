/**
 * Copyright 2023 Nokia
 * Licensed under the BSD 3-Clause License.
 * SPDX-License-Identifier: BSD-3-Clause
*/

'use strict';

import * as vscode from 'vscode'; // import the vscode module (VS Code API)
import * as os from 'os'; //  import operating system
import * as fs from 'fs'; // import filesystem

// WorkflowManagerProvider is a class that contains all workflow operations and implements the filesystem
import { WorkflowManagerProvider, CodelensProvider } from './providers';

export async function activate(context: vscode.ExtensionContext) { // Ran upon extension activation:

	// ensure alignement of NSP servers between Intent Manager and Workflow Manager upon activation
	let imConfig = vscode.workspace.getConfiguration('intentManager');
	let wfmConfig = vscode.workspace.getConfiguration('workflowManager');

	// NSP - Multiple Server Support:
	const statusbar_server = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 90);
	statusbar_server.command = 'nokia-wfm.setServer';
	statusbar_server.tooltip = 'Set Workflow-Manager NSP Server';
	statusbar_server.text = 'NSP: ' + wfmConfig.get("activeServer") ?? 'Select Server';
	statusbar_server.show();

	if (imConfig.get("NSPS") != wfmConfig.get("NSPS")) {
		let servers = imConfig.get("NSPS") ?? {};
		wfmConfig.update("NSPS", servers, vscode.ConfigurationTarget.Global);
	}

	if (imConfig.get("activeServer") != wfmConfig.get("activeServer")) {
		let server = imConfig.get("activeServer"); // update the active server:
		wfmConfig.update("activeServer", server, vscode.ConfigurationTarget.Workspace);
		statusbar_server.text = 'NSP: ' + server;
	}

	const secretStorage: vscode.SecretStorage = context.secrets;
	const config = vscode.workspace.getConfiguration('workflowManager');
	const server : string   = config.get("activeServer")   ?? "localhost"; // active server is the first server in the NSP server list.
	const username : string = config.get("username") ?? "admin";
	const port : string = config.get("port") ?? "";
	const timeout : number = config.get("timeout") ?? 20000;
	const localsave : boolean = config.get("localStorage.enable") ?? false;
	const localpath : string = config.get("localStorage.folder") ?? "";
	const fileIgnore : Array<string> = config.get("ignoreTags") ?? [];
	const wfmProvider = new WorkflowManagerProvider(server, username, secretStorage, port, localsave, localpath, timeout, fileIgnore);

	// Beginning of implementation for status bar for either 
	const isStatusBarEnabledIM = config.get("intentManager.isStatusBar");
	const isStatusBarEnabledWFM = config.get("workflowManager.isStatusBar");
	
	let servers = config.get("NSPS");
	console.log('servers: ', servers);

	context.subscriptions.push(vscode.workspace.registerFileSystemProvider('wfm', wfmProvider, { isCaseSensitive: true }));
	context.subscriptions.push(vscode.window.registerFileDecorationProvider(wfmProvider));
	wfmProvider.extContext=context;
	console.log("Workflow Manager Provider registered");
	
	const header = new CodelensProvider(server); 
	context.subscriptions.push(vscode.languages.registerCodeLensProvider({language: 'yaml', scheme: 'wfm'}, header));
	context.subscriptions.push(vscode.languages.registerCodeLensProvider({language: 'jinja', scheme: 'wfm'}, header));

	// // PUBLISHING COMMANDS
	// // --- A handler for the 'nokia-wfm.validate' command when the user clicks the checkmark
	context.subscriptions.push(vscode.commands.registerCommand('nokia-wfm.validate', async () => {
		wfmProvider.validate(); // validate an action, workflow, or template.
	}));

	// // --- A handler to Open workflow in Workflow Manager (Webbrowser) when the user clicks the link
	context.subscriptions.push(vscode.commands.registerCommand('nokia-wfm.openInBrowser', async () => {
		wfmProvider.openInBrowser();
	}));

	// // --- A handler to Apply schema for validation when the schema is not applied
	context.subscriptions.push(vscode.commands.registerCommand('nokia-wfm.applySchema', async () => {
		wfmProvider.applySchema();
	}));

	// --- A handler to Execute workflow in Workflow Manager when the user clicks the play button
	context.subscriptions.push(vscode.commands.registerCommand('nokia-wfm.execute', async () => {
		wfmProvider.execute();
	}));

	// // --- Get last execution result - when the user clicks the eye button
	context.subscriptions.push(vscode.commands.registerCommand('nokia-wfm.lastResult', async () => {
		wfmProvider.lastResult();
	}));

	// // --- Upload workflow from local file-system when 
	context.subscriptions.push(vscode.commands.registerCommand('nokia-wfm.upload', async () => {
		wfmProvider.upload();
	}));

	//  --- generate input form for workflow view
	context.subscriptions.push(vscode.commands.registerCommand('nokia-wfm.generateForm', async () => {
		wfmProvider.generateForm();
	}));

	// --- Set Workflow Manager NSP Server when the user clicks the server button
	context.subscriptions.push(vscode.commands.registerCommand('nokia-wfm.setServer', async () => {
		let updatedConfig = vscode.workspace.getConfiguration('workflowManager');
		wfmProvider.setServer(updatedConfig, statusbar_server, secretStorage); // set Active Workflow Manager NSP Server
	}));

	// --- subscription for changes in the configuration
	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async (e) => {
		if (e.affectsConfiguration('workflowManager')) {
			wfmProvider.updateSettings();
		}
		if (e.affectsConfiguration('intentManager')) { // update workflow manager NSP list: 
			const imConfig = vscode.workspace.getConfiguration('intentManager');
			let wfmConfig = vscode.workspace.getConfiguration('workflowManager');
			if (imConfig.get("NSPS") != wfmConfig.get("NSPS")) {
				let servers = imConfig.get("NSPS") ?? {};
				wfmConfig.update("NSPS", servers, vscode.ConfigurationTarget.Global);
			}
			if (imConfig.get("activeServer") != wfmConfig.get("activeServer")) {
				let server = imConfig.get("activeServer"); // update the active server:
				wfmConfig.update("activeServer", server, vscode.ConfigurationTarget.Workspace);
				statusbar_server.text = 'NSP: ' + server;
			}
			wfmProvider.updateSettings();
		}
	}));

	// Generate schema for validation
	wfmProvider.generateSchema();

	/*
	 *--- WORKFLOW EXAMPLES: When we click the bottom cloud button the nsp-workflow repo
	 * is cloned to the workspace-
	 * Add workflow examples to workspace (Bottom Cloud Button)
	*/
	const statusbar_examples = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 91);
	statusbar_examples.command = 'nokia-wfm.examples';
	statusbar_examples.tooltip = 'Add workflow examples to workspace';
	statusbar_examples.text = '$(cloud-download)';
	statusbar_examples.hide();

	context.subscriptions.push(vscode.commands.registerCommand('nokia-wfm.examples', async () => {
		let gitPath = vscode.workspace.getConfiguration('git').get<string>('defaultCloneDirectory') || os.homedir();
		gitPath = gitPath.replace(/^~/, os.homedir());
		const gitUri = vscode.Uri.parse('file://'+gitPath);
		const repoUri = vscode.Uri.joinPath(gitUri, 'nsp-workflow');

		if (fs.existsSync(repoUri.fsPath)) {
			console.log('nsp-workflow already exists, add to workspace');
			vscode.workspace.updateWorkspaceFolders(vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.length : 0, null, { uri: repoUri});
		} else {
			console.log('clone nsp-workflow to add to workspace');
			vscode.commands.executeCommand('git.clone', 'https://github.com/nokia/nsp-workflow.git', gitPath);
		}
	}));
	
	// Set Password for WFM
	vscode.commands.registerCommand('nokia-wfm.setPassword', async () => {
		const passwordInput: string = await vscode.window.showInputBox({
		  password: true, 
		  title: "Password"
		}) ?? '';
		if(passwordInput !== '') {
			secretStorage.store(server + '_password', passwordInput);
		};
	});
	
	// checks if 
	vscode.workspace.onDidChangeWorkspaceFolders(async () => {
		const workspaceFolders =  vscode.workspace.workspaceFolders ?  vscode.workspace.workspaceFolders : [];
		if (workspaceFolders.find( ({name}) => name === 'nsp-workflow')) {
			statusbar_examples.hide();
		} else {
			statusbar_examples.show();
		}	
	});

	const workspaceFolders =  vscode.workspace.workspaceFolders ?  vscode.workspace.workspaceFolders : [];
	if (!(workspaceFolders.find( ({name}) => name === 'nsp-workflow'))) {
		statusbar_examples.show();
	}

	// Apply YAML language to all wfm:/actions/* and wfm:/workflows/* files
	let fileAssociations : {string: string} = vscode.workspace.getConfiguration('files').get('associations') || <{string: string}>{};
	fileAssociations["/actions/*"] = "yaml"; // apply YAML language to all wfm:/actions/* files
	fileAssociations["/templates/*"] = "jinja"; // apply YAML language to all wfm:/templates/* files - Needed so that icons can show up for templates
	fileAssociations["/workflows/*"] = "yaml"; // apply YAML language to all wfm:/workflows/* files
	vscode.workspace.getConfiguration('files').update('associations', fileAssociations);

	// Add Workflow Manager folder to workspace
	vscode.workspace.updateWorkspaceFolders(vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.length : 0, null, { uri: vscode.Uri.parse('wfm:/'), name: "Workflow Manager" });
}