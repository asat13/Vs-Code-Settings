"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const chokidar = require("chokidar");
const fs = require("fs");
const path = require("path");
const vscode_1 = require("vscode");
const appInsightsClient_1 = require("./appInsightsClient");
const executor_1 = require("./executor");
const logger_1 = require("./logger");
const testDiscovery_1 = require("./testDiscovery");
const utility_1 = require("./utility");
class TestCommands {
    constructor(resultsFile, testDirectories) {
        this.resultsFile = resultsFile;
        this.testDirectories = testDirectories;
        this.onTestDiscoveryStartedEmitter = new vscode_1.EventEmitter();
        this.onTestDiscoveryFinishedEmitter = new vscode_1.EventEmitter();
        this.onTestRunEmitter = new vscode_1.EventEmitter();
        this.onNewTestResultsEmitter = new vscode_1.EventEmitter();
        this.lastRunTestContext = null;
    }
    dispose() {
        try {
            if (this.testResultsFolderWatcher) {
                this.testResultsFolderWatcher.close();
            }
        }
        catch (err) {
        }
    }
    discoverTests() {
        this.onTestDiscoveryStartedEmitter.fire();
        this.testDirectories.clearTestsForDirectory();
        const testDirectories = this.testDirectories.getTestDirectories();
        this.waitForAllTests = {
            currentNumberOfFiles: 0,
            expectedNumberOfFiles: 0,
            testResults: [],
            clearPreviousTestResults: false,
            numberOfTestDirectories: testDirectories.length,
        };
        this.setupTestResultFolder();
        const runSeqOrAsync = () => __awaiter(this, void 0, void 0, function* () {
            const addToDiscoveredTests = (discoverdTestResult, dir) => {
                if (discoverdTestResult.testNames.length <= 0) {
                    this.testDirectories.removeTestDirectory(dir);
                }
                else {
                    discoveredTests.push(discoverdTestResult);
                }
            };
            const discoveredTests = [];
            try {
                if (utility_1.Utility.runInParallel) {
                    yield Promise.all(testDirectories.map((dir) => __awaiter(this, void 0, void 0, function* () { return yield addToDiscoveredTests(yield this.discoverTestsInFolder(dir), dir); })));
                }
                else {
                    for (const dir of testDirectories) {
                        addToDiscoveredTests(yield this.discoverTestsInFolder(dir), dir);
                    }
                }
                // Number of test directories might have been decreased due to none-test directories being added by the glob / workspace filter
                this.waitForAllTests.numberOfTestDirectories = this.testDirectories.getTestDirectories().length;
                this.onTestDiscoveryFinishedEmitter.fire(discoveredTests);
            }
            catch (error) {
                this.onTestDiscoveryFinishedEmitter.fire([]);
            }
        });
        runSeqOrAsync();
    }
    discoverTestsInFolder(dir) {
        return __awaiter(this, void 0, void 0, function* () {
            const testsForDir = yield testDiscovery_1.discoverTests(dir, utility_1.Utility.additionalArgumentsOption);
            this.testDirectories.addTestsForDirectory(testsForDir.testNames.map((tn) => ({ dir, name: tn })));
            return testsForDir;
        });
    }
    get testResultFolder() {
        return this.testResultsFolder;
    }
    get onTestDiscoveryStarted() {
        return this.onTestDiscoveryStartedEmitter.event;
    }
    get onTestDiscoveryFinished() {
        return this.onTestDiscoveryFinishedEmitter.event;
    }
    get onTestRun() {
        return this.onTestRunEmitter.event;
    }
    get onNewTestResults() {
        return this.onNewTestResultsEmitter.event;
    }
    sendNewTestResults(testResults) {
        this.onNewTestResultsEmitter.fire(testResults);
    }
    sendRunningTest(testContext) {
        this.onTestRunEmitter.fire(testContext);
    }
    watchRunningTests(namespace) {
        const textContext = { testName: namespace, isSingleTest: false };
        this.sendRunningTest(textContext);
    }
    runAllTests() {
        this.runTestCommand("", false);
        appInsightsClient_1.AppInsightsClient.sendEvent("runAllTests");
    }
    runTest(test) {
        this.runTestByName(test.fqn, !test.isFolder);
    }
    runTestByName(testName, isSingleTest) {
        this.runTestCommand(testName, isSingleTest);
        appInsightsClient_1.AppInsightsClient.sendEvent("runTest");
    }
    debugTestByName(testName, isSingleTest) {
        this.runTestCommand(testName, isSingleTest, true);
        appInsightsClient_1.AppInsightsClient.sendEvent("runTest");
    }
    rerunLastCommand() {
        if (this.lastRunTestContext != null) {
            this.runTestCommand(this.lastRunTestContext.testName, this.lastRunTestContext.isSingleTest);
            appInsightsClient_1.AppInsightsClient.sendEvent("rerunLastCommand");
        }
    }
    setupTestResultFolder() {
        if (!this.testResultsFolder) {
            const me = this;
            this.testResultsFolder = fs.mkdtempSync(path.join(utility_1.Utility.pathForResultFile, "test-explorer-"));
            this.testResultsFolderWatcher = chokidar.watch("*.trx", { cwd: this.testResultsFolder }).on("add", (p) => {
                logger_1.Logger.Log("New test results file");
                me.resultsFile.parseResults(path.join(me.testResultsFolder, p))
                    .then((testResults) => {
                    me.waitForAllTests.currentNumberOfFiles = me.waitForAllTests.currentNumberOfFiles + 1;
                    me.waitForAllTests.testResults = me.waitForAllTests.testResults.concat(testResults);
                    logger_1.Logger.Log(`Parsed ${me.waitForAllTests.currentNumberOfFiles}/${me.waitForAllTests.expectedNumberOfFiles} file(s)`);
                    if ((me.waitForAllTests.numberOfTestDirectories === 1) || (me.waitForAllTests.currentNumberOfFiles >= me.waitForAllTests.expectedNumberOfFiles)) {
                        logger_1.Logger.Log(`Parsed all expected test results, updating tree`);
                        me.sendNewTestResults({ clearPreviousTestResults: me.waitForAllTests.clearPreviousTestResults, testResults: me.waitForAllTests.testResults });
                        this.waitForAllTests.currentNumberOfFiles = 0;
                        this.waitForAllTests.expectedNumberOfFiles = 0;
                        this.waitForAllTests.testResults = [];
                        this.waitForAllTests.clearPreviousTestResults = false;
                    }
                });
            });
        }
    }
    runTestCommand(testName, isSingleTest, debug) {
        if (this.waitForAllTests.expectedNumberOfFiles > 0) {
            logger_1.Logger.Log("Tests already running, ignore request to run tests for " + testName);
            return;
        }
        vscode_1.commands.executeCommand("workbench.view.extension.test", "workbench.view.extension.test");
        const testDirectories = this
            .testDirectories
            .getTestDirectories(testName);
        if (testDirectories.length < 1) {
            logger_1.Logger.LogWarning("Could not find a matching test directory for test " + testName);
            return;
        }
        if (testName === "") {
            this.waitForAllTests.expectedNumberOfFiles = this.waitForAllTests.numberOfTestDirectories;
            this.waitForAllTests.clearPreviousTestResults = true;
        }
        else {
            this.waitForAllTests.expectedNumberOfFiles = 1;
        }
        logger_1.Logger.Log(`Test run for ${testName}, expecting ${this.waitForAllTests.expectedNumberOfFiles} test results file(s) in total`);
        for (const {} of testDirectories) {
            const testContext = { testName, isSingleTest };
            this.lastRunTestContext = testContext;
            this.sendRunningTest(testContext);
        }
        const runSeqOrAsync = () => __awaiter(this, void 0, void 0, function* () {
            try {
                if (utility_1.Utility.runInParallel) {
                    yield Promise.all(testDirectories.map((dir, i) => __awaiter(this, void 0, void 0, function* () { return this.runTestCommandForSpecificDirectory(dir, testName, isSingleTest, i, debug); })));
                }
                else {
                    for (let i = 0; i < testDirectories.length; i++) {
                        yield this.runTestCommandForSpecificDirectory(testDirectories[i], testName, isSingleTest, i, debug);
                    }
                }
            }
            catch (err) {
                logger_1.Logger.Log(`Error while executing test command: ${err}`);
                this.discoverTests();
            }
        });
        runSeqOrAsync();
    }
    runBuildCommandForSpecificDirectory(testDirectoryPath) {
        return new Promise((resolve, reject) => {
            if (utility_1.Utility.skipBuild) {
                logger_1.Logger.Log(`User has passed --no-build, skipping build`);
                resolve();
            }
            else {
                logger_1.Logger.Log(`Executing dotnet build in ${testDirectoryPath}`);
                executor_1.Executor.exec("dotnet build", (err, stdout) => {
                    if (err) {
                        reject(new Error("Build command failed"));
                    }
                    resolve();
                }, testDirectoryPath);
            }
        });
    }
    runTestCommandForSpecificDirectory(testDirectoryPath, testName, isSingleTest, index, debug) {
        const trxTestName = index + ".trx";
        return new Promise((resolve, reject) => {
            const testResultFile = path.join(this.testResultsFolder, trxTestName);
            let command = `dotnet test${utility_1.Utility.additionalArgumentsOption} --no-build --logger \"trx;LogFileName=${testResultFile}\"`;
            if (testName && testName.length) {
                if (isSingleTest) {
                    command = command + ` --filter "FullyQualifiedName=${testName.replace(/\(.*\)/g, "")}"`;
                }
                else {
                    command = command + ` --filter "FullyQualifiedName~${testName.replace(/\(.*\)/g, "")}"`;
                }
            }
            this.runBuildCommandForSpecificDirectory(testDirectoryPath)
                .then(() => {
                logger_1.Logger.Log(`Executing ${command} in ${testDirectoryPath}`);
                if (!debug) {
                    return executor_1.Executor.exec(command, (err, stdout) => {
                        if (err && err.killed) {
                            logger_1.Logger.Log("User has probably cancelled test run");
                            reject(new Error("UserAborted"));
                        }
                        logger_1.Logger.Log(stdout, "Test Explorer (Test runner output)");
                        resolve();
                    }, testDirectoryPath, true);
                }
                else {
                    return executor_1.Executor.debug(command, (err, stdout) => {
                        if (err && err.killed) {
                            logger_1.Logger.Log("User has probably cancelled test run");
                            reject(new Error("UserAborted"));
                        }
                        logger_1.Logger.Log(stdout, "Test Explorer (Test runner output)");
                        resolve();
                    }, testDirectoryPath, true);
                }
            })
                .catch((err) => {
                reject(err);
            });
        });
    }
}
exports.TestCommands = TestCommands;
//# sourceMappingURL=testCommands.js.map