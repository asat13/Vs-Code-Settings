"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
class StatusBar {
    constructor(testCommand) {
        this.status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        testCommand.onTestDiscoveryStarted(this.updateWithDiscoveringTest, this);
        this.discovering();
    }
    discovering() {
        this.baseStatusText = "";
        this.status.text = `$(beaker) $(sync~spin) Discovering tests`;
        this.status.show();
    }
    discovered(numberOfTests) {
        this.baseStatusText = `$(beaker) ${numberOfTests} tests`;
        this.status.text = this.baseStatusText;
    }
    testRunning(numberOfTestRun) {
        this.status.text = `${this.baseStatusText} ($(sync~spin) Running ${numberOfTestRun} tests)`;
    }
    testRun(results) {
        const failed = results.filter((r) => r.outcome === "Failed").length;
        const notExecuted = results.filter((r) => r.outcome === "NotExecuted").length;
        const passed = results.filter((r) => r.outcome === "Passed").length;
        this.status.text = `${this.baseStatusText} ($(check) ${passed} | $(x) ${failed}) | $(question) ${notExecuted})`;
    }
    dispose() {
        if (this.status) {
            this.status.dispose();
        }
    }
    updateWithDiscoveringTest() {
        this.discovering();
    }
}
exports.StatusBar = StatusBar;
//# sourceMappingURL=statusBar.js.map