/**
 * Copyright 2024 Nokia
 * Licensed under the BSD 3-Clause License.
 * SPDX-License-Identifier: BSD-3-Clause
*/

'use strict';

import * as vscode from 'vscode'; // import the vscode module (VS Code API)
import * as os from 'os'; //  import operating system
import * as fs from 'fs'; // import filesystem

import { WorkflowManagerProvider, CodelensProvider } from './providers';

export async function activate(context: vscode.ExtensionContext) { // Ran upon extension activation:
	let imConfig = await vscode.workspace.getConfiguration('intentManager');
	let wfmConfig = await vscode.workspace.getConfiguration('workflowManager');

	const nspServerStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 90);
	nspServerStatusBar.command = 'nokia-wfm.setServer';
	nspServerStatusBar.tooltip = 'Set NSP Server';
	nspServerStatusBar.text = 'NSP: ' + wfmConfig.get("activeServer");

	let header = new CodelensProvider(wfmConfig.get("activeServer")); // create a new header for the codelens
	context.subscriptions.push(vscode.languages.registerCodeLensProvider({language: 'yaml', scheme: 'wfm'}, header));
	context.subscriptions.push(vscode.languages.registerCodeLensProvider({language: 'jinja', scheme: 'wfm'}, header));

	const imExtension = vscode.extensions.getExtension('Nokia.nokia-intent-manager');	
	await new Promise(resolve => setTimeout(resolve, 500)); // sleep for 0.5 second so IM loads first:
	if (imExtension?.isActive) { // if the IM extension is active
		nspServerStatusBar.hide();
	} else {
		nspServerStatusBar.show();
	}

	if (imConfig.get("activeServer") !== undefined) {
		let imNSPS:any = imConfig.get("NSPS") ?? [];
		let wfmNSPS:any = wfmConfig.get("NSPS") ?? [];

		let wfmNSPSMap = new Map();
		wfmNSPS.forEach(item => {
			wfmNSPSMap.set(item.id, item);
		});

		imNSPS.forEach(imItem => {
			let wfmItem = wfmNSPSMap.get(imItem.id);
			if (wfmItem) {
				if (imItem.port === "443") {
					wfmItem.port = imItem.port;
				}
			} else {
				wfmNSPS.push(imItem);
			}
		});
		wfmConfig.update("NSPS", wfmNSPS, vscode.ConfigurationTarget.Global);

		if (imConfig.get("activeServer") != wfmConfig.get("activeServer")) {
			let server:string = imConfig.get("activeServer"); // update the active server:
			wfmConfig.update("activeServer", server, vscode.ConfigurationTarget.Workspace);
			nspServerStatusBar.text = 'NSP: ' + server; 
			context.subscriptions.forEach((element) => {
				if (element instanceof CodelensProvider) {
					element.dispose();
				}
			});
			header.ip = server;
		}
	}

	const secretStorage: vscode.SecretStorage = context.secrets;
	const config = vscode.workspace.getConfiguration('workflowManager');
	const server : string   = config.get("activeServer")   ?? "localhost"; // active server is the first server in the NSP server list.
	const timeout : number = config.get("timeout") ?? 20000;
	const localsave : boolean = config.get("localStorage.enable") ?? false;
	const localpath : string = config.get("localStorage.folder") ?? "";
	const fileIgnore : Array<string> = config.get("ignoreTags") ?? [];
	const wfmProvider = new WorkflowManagerProvider(secretStorage, localsave, localpath, timeout, fileIgnore);

	context.subscriptions.push(vscode.workspace.registerFileSystemProvider('wfm', wfmProvider, { isCaseSensitive: true }));
	context.subscriptions.push(vscode.window.registerFileDecorationProvider(wfmProvider));
	wfmProvider.extContext=context;
		
	// --- A handler for the 'nokia-wfm.validate' command when the user clicks the checkmark
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
		wfmProvider.setServer(updatedConfig, nspServerStatusBar, secretStorage); // set Active Workflow Manager NSP Server
	}));

	// --- subscription for changes in the configuration
	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async (e) => {

		if (e.affectsConfiguration('workflowManager')) {
			wfmProvider.updateSettings();
		}
		if (e.affectsConfiguration('intentManager')) { // update workflow manager NSP list: 
			const imConfig = vscode.workspace.getConfiguration('intentManager');
			let wfmConfig = vscode.workspace.getConfiguration('workflowManager');
			
			if (e.affectsConfiguration('intentManager.NSPS')) {
				const imConfig = vscode.workspace.getConfiguration('intentManager');
				let wfmConfig = vscode.workspace.getConfiguration('workflowManager');
			
				if (e.affectsConfiguration('intentManager.NSPS')) {
					let imNSPS:any = imConfig.get("NSPS") ?? [];
					let wfmNSPS:any = wfmConfig.get("NSPS") ?? [];
			
					let wfmNSPSMap = new Map();
					wfmNSPS.forEach(item => {
						wfmNSPSMap.set(item.id, item);
					});
			
					imNSPS.forEach(imItem => {
						let wfmItem = wfmNSPSMap.get(imItem.id);
						if (wfmItem) {
							if (imItem.port === "443") {
								wfmItem.port = imItem.port;
							}
						} else {
							wfmNSPS.push(imItem);
						}
					});
					wfmConfig.update("NSPS", wfmNSPS, vscode.ConfigurationTarget.Global);
				}
			}
			if (imConfig.get("activeServer") != wfmConfig.get("activeServer")) {
				let server:string = imConfig.get("activeServer"); // update the active server:
				wfmConfig.update("activeServer", server, vscode.ConfigurationTarget.Workspace);
				nspServerStatusBar.text = 'NSP: ' + server;
				
				context.subscriptions.forEach((element) => { // remove the old header 
					if (element instanceof CodelensProvider) {
						element.dispose();
					}
				});
				header.ip = server;
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
			vscode.workspace.updateWorkspaceFolders(vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.length : 0, null, { uri: repoUri});
		} else {
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

	vscode.workspace.updateWorkspaceFolders(vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders.length : 0, null, { uri: vscode.Uri.parse('wfm:/'), name: "Workflow Manager" });
}