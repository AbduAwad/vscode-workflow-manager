import * as vscode from 'vscode';

export class wfmProviderUtils {

    /**
     * Utility Method to parse the IP address from the quick pick selection
     * @param {readonly vscode.QuickPickItem[]} selection - The selection from the quick pick
    */
    public static parseIPFromQuickPickSelection(selection: readonly vscode.QuickPickItem[]): string {

        let ip = selection[0].label;
        const ipRegex = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/;
        const match = ip.match(ipRegex);
        
        if (match) {
            return match[0];
        } else {
            vscode.window.showErrorMessage("Not a valid IP address");
            return;
        } 
    }

    /**
	 * Utility Method to check wether a port is associated with an IP in the global config's NSP List
	 * @param {Array<any>} serverList - The list of servers from the global config
	 * @param {string} ip - The ip address of the server to check if it has a port
	*/
	public static async isPortAssociated(serverList: Array<any>, ip: string): Promise<boolean> {
		for (let i = 0; i < serverList.length; i++) {
			if (serverList[i].ip === ip) {
				if (serverList[i].port != undefined) {
					return true;
				} 
				return false;
			}
		}
		return false;
	}
}