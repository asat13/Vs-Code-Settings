"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utility_1 = require("./utility");
class TestNode {
    constructor(_parentPath, _name, testResults, _children) {
        this._parentPath = _parentPath;
        this._name = _name;
        this._children = _children;
        this.setIcon(testResults);
        this._fqn = utility_1.Utility
            .getFqnTestName(this.fullName)
            .replace("+", "."); // nested classes are reported as ParentClass+ChildClass;
    }
    get name() {
        return this._name;
    }
    get fullName() {
        return (this._parentPath ? `${this._parentPath}.` : "") + this._name;
    }
    get fqn() {
        // We need to translate from how the test is represented in the tree to what it's fully qualified name is
        return this._fqn;
    }
    get parentPath() {
        return this._parentPath;
    }
    get isFolder() {
        return this._children && this._children.length > 0;
    }
    get children() {
        return this._children;
    }
    get isError() {
        return !!this._isError;
    }
    get icon() {
        return (this._isLoading) ? "spinner.svg" : this._icon;
    }
    setAsError(error) {
        this._isError = true;
        this._name = error;
    }
    setAsLoading() {
        this._isLoading = true;
    }
    setIcon(testResults) {
        this._isLoading = false;
        if (!testResults) {
            this._icon = this.isFolder ? "namespace.png" : "run.png";
        }
        else {
            if (this.isFolder) {
                const testsForFolder = testResults.filter((tr) => tr.fullName.startsWith(this.fullName));
                if (testsForFolder.some((tr) => tr.outcome === "Failed")) {
                    this._icon = "namespaceFailed.png";
                }
                else if (testsForFolder.some((tr) => tr.outcome === "NotExecuted")) {
                    this._icon = "namespaceNotExecuted.png";
                }
                else if (testsForFolder.some((tr) => tr.outcome === "Passed")) {
                    this._icon = "namespacePassed.png";
                }
                else {
                    this._icon = "namespace.png";
                }
            }
            else {
                const resultForTest = testResults.find((tr) => tr.fullName === this.fullName);
                if (resultForTest) {
                    this._icon = "test".concat(resultForTest.outcome, ".png");
                }
                else {
                    this._icon = "testNotRun.png";
                }
            }
        }
    }
}
exports.TestNode = TestNode;
//# sourceMappingURL=testNode.js.map