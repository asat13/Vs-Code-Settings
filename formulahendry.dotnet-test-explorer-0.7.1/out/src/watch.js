"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const appInsightsClient_1 = require("./appInsightsClient");
const executor_1 = require("./executor");
const logger_1 = require("./logger");
const utility_1 = require("./utility");
class Watch {
    constructor(testCommands, testDirectories) {
        this.testCommands = testCommands;
        this.testDirectories = testDirectories;
        this.watchedDirectories = [];
        if (utility_1.Utility.getConfiguration().get("autoWatch")) {
            this.testCommands.onTestDiscoveryFinished(this.setupWatcherForAllDirectories, this);
        }
    }
    setupWatcherForAllDirectories() {
        const allDirectories = this.testDirectories.getTestDirectories();
        for (let i = 0; i < allDirectories.length; i++) {
            this.setupWatch(allDirectories[i], this.getNamespaceForTestDirectory(allDirectories[i]), i);
        }
    }
    setupWatch(testDirectory, namespaceForDirectory, index) {
        if (this.watchedDirectories.some((wd) => wd === testDirectory)) {
            logger_1.Logger.Log("Skipping adding watch since already watching directory " + testDirectory);
            return;
        }
        logger_1.Logger.Log("Starting watch for " + testDirectory);
        const trxPath = path.join(this.testCommands.testResultFolder, `autoWatch${index}.trx`);
        appInsightsClient_1.AppInsightsClient.sendEvent("runWatchCommand");
        const command = `dotnet watch test${utility_1.Utility.additionalArgumentsOption} --logger "trx;LogFileName=${trxPath}"`;
        logger_1.Logger.Log(`Executing ${command} in ${testDirectory}`);
        const p = executor_1.Executor.exec(command, (err, stdout) => {
            logger_1.Logger.Log(stdout);
        }, testDirectory, true);
        p.stdout.on("data", (buf) => {
            const stdout = String(buf);
            logger_1.Logger.Log(stdout);
            // Only notify that test are running when a watch has triggered due to changes
            if (stdout.indexOf("watch : Started") > -1) {
                this.testCommands.watchRunningTests(namespaceForDirectory);
            }
        });
        p.stdout.on("close", (buf) => {
            logger_1.Logger.Log("Stopping watch");
            this.watchedDirectories = this.watchedDirectories.filter((wd) => wd !== testDirectory);
        });
    }
    getNamespaceForTestDirectory(testDirectory) {
        const firstTestForDirectory = this.testDirectories.getFirstTestForDirectory(testDirectory);
        return firstTestForDirectory.substring(0, firstTestForDirectory.indexOf(".") - 1);
    }
}
exports.Watch = Watch;
//# sourceMappingURL=watch.js.map