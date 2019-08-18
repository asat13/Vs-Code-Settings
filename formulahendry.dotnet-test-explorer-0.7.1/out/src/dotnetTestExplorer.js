"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const vscode = require("vscode");
const vscode_1 = require("vscode");
const appInsightsClient_1 = require("./appInsightsClient");
const logger_1 = require("./logger");
const testNode_1 = require("./testNode");
const utility_1 = require("./utility");
class DotnetTestExplorer {
    constructor(context, testCommands, resultsFile, statusBar) {
        this.context = context;
        this.testCommands = testCommands;
        this.resultsFile = resultsFile;
        this.statusBar = statusBar;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.allNodes = [];
        testCommands.onTestDiscoveryFinished(this.updateWithDiscoveredTests, this);
        testCommands.onTestDiscoveryStarted(this.updateWithDiscoveringTest, this);
        testCommands.onTestRun(this.updateTreeWithRunningTests, this);
        testCommands.onNewTestResults(this.addTestResults, this);
    }
    /**
     * @description
     * Refreshes the test explorer pane by running the
     * `dotnet test` command and requesting information about
     * discovered tests.
     * @summary
     * This method can cause the project to rebuild or try
     * to do a restore, so it can be very slow.
     */
    refreshTestExplorer() {
        this.testCommands.discoverTests();
        appInsightsClient_1.AppInsightsClient.sendEvent("refreshTestExplorer");
    }
    getTreeItem(element) {
        if (element.isError) {
            return new vscode_1.TreeItem(element.name);
        }
        return {
            label: element.name,
            collapsibleState: element.isFolder ? utility_1.Utility.defaultCollapsibleState : void 0,
            iconPath: element.icon ? {
                dark: this.context.asAbsolutePath(path.join("resources", "dark", element.icon)),
                light: this.context.asAbsolutePath(path.join("resources", "light", element.icon)),
            } : void 0,
            contextValue: element.isFolder ? "folder" : "test",
            command: element.isFolder ? null : {
                command: "dotnet-test-explorer.leftClickTest",
                title: "",
                arguments: [element],
            },
        };
    }
    getChildren(element) {
        if (element) {
            return element.children;
        }
        if (!this.discoveredTests) {
            const loadingNode = new testNode_1.TestNode("", "Discovering tests", this.testResults);
            loadingNode.setAsLoading();
            return [loadingNode];
        }
        if (this.discoveredTests.length === 0) {
            return ["Please open or set the test project", "and ensure your project compiles."].map((e) => {
                const node = new testNode_1.TestNode("", e, this.testResults);
                node.setAsError(e);
                return node;
            });
        }
        const useTreeView = utility_1.Utility.getConfiguration().get("useTreeView");
        if (!useTreeView) {
            return this.discoveredTests.map((name) => {
                return new testNode_1.TestNode("", name, this.testResults);
            });
        }
        const structuredTests = {};
        this.allNodes = [];
        this.discoveredTests.forEach((name) => {
            try {
                // Split name on all dots that are not inside parenthesis MyNamespace.MyClass.MyMethod(value: "My.Dot") -> MyNamespace, MyClass, MyMethod(value: "My.Dot")
                this.addToObject(structuredTests, name.split(/\.(?![^\(]*\))/g));
            }
            catch (err) {
                logger_1.Logger.LogError(`Failed to add test with name ${name}`, err);
            }
        });
        const root = this.createTestNode("", structuredTests);
        return root;
    }
    addToObject(container, parts) {
        const title = parts.splice(0, 1)[0];
        if (parts.length > 1) {
            if (!container[title]) {
                container[title] = {};
            }
            this.addToObject(container[title], parts);
        }
        else {
            if (!container[title]) {
                container[title] = [];
            }
            if (parts.length === 1) {
                container[title].push(parts[0]);
            }
        }
    }
    createTestNode(parentPath, test) {
        let testNodes;
        if (Array.isArray(test)) {
            testNodes = test.map((t) => {
                return new testNode_1.TestNode(parentPath, t, this.testResults);
            });
        }
        else if (typeof test === "object") {
            testNodes = Object.keys(test).map((key) => {
                return new testNode_1.TestNode(parentPath, key, this.testResults, this.createTestNode((parentPath ? `${parentPath}.` : "") + key, test[key]));
            });
        }
        else {
            testNodes = [new testNode_1.TestNode(parentPath, test, this.testResults)];
        }
        this.allNodes = this.allNodes.concat(testNodes);
        return testNodes;
    }
    updateWithDiscoveringTest() {
        this.discoveredTests = null;
        this._onDidChangeTreeData.fire();
    }
    updateWithDiscoveredTests(results) {
        this.allNodes = [];
        this.discoveredTests = [].concat(...results.map((r) => r.testNames));
        this.statusBar.discovered(this.discoveredTests.length);
        this._onDidChangeTreeData.fire();
    }
    updateTreeWithRunningTests(testRunContext) {
        const filter = testRunContext.isSingleTest ?
            ((testNode) => testNode.fqn === testRunContext.testName)
            : ((testNode) => testNode.fullName.startsWith(testRunContext.testName));
        const testRun = this.allNodes.filter((testNode) => !testNode.isFolder && filter(testNode));
        this.statusBar.testRunning(testRun.length);
        testRun.forEach((testNode) => {
            testNode.setAsLoading();
            this._onDidChangeTreeData.fire(testNode);
        });
    }
    addTestResults(results) {
        const fullNamesForTestResults = results.testResults.map((r) => r.fullName);
        if (results.clearPreviousTestResults) {
            this.discoveredTests = [...fullNamesForTestResults];
            this.testResults = null;
        }
        else {
            const newTests = fullNamesForTestResults.filter((r) => this.discoveredTests.indexOf(r) === -1);
            if (newTests.length > 0) {
                this.discoveredTests.push(...newTests);
            }
        }
        this.discoveredTests = this.discoveredTests.sort();
        this.statusBar.discovered(this.discoveredTests.length);
        if (this.testResults) {
            results.testResults.forEach((newTestResult) => {
                const indexOldTestResult = this.testResults.findIndex((tr) => tr.fullName === newTestResult.fullName);
                if (indexOldTestResult < 0) {
                    this.testResults.push(newTestResult);
                }
                else {
                    this.testResults[indexOldTestResult] = newTestResult;
                }
            });
        }
        else {
            this.testResults = results.testResults;
        }
        this.statusBar.testRun(results.testResults);
        this._onDidChangeTreeData.fire();
    }
}
exports.DotnetTestExplorer = DotnetTestExplorer;
//# sourceMappingURL=dotnetTestExplorer.js.map