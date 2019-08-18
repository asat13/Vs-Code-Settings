"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const glob = require("glob");
const path = require("path");
const vscode = require("vscode");
const logger_1 = require("./logger");
const utility_1 = require("./utility");
class TestDirectories {
    parseTestDirectories() {
        if (!vscode.workspace || !vscode.workspace.workspaceFolders) {
            return;
        }
        const testDirectoryGlob = utility_1.Utility.getConfiguration().get("testProjectPath");
        this.directories = [];
        const matchingDirs = [];
        vscode.workspace.workspaceFolders.forEach((folder) => {
            const globPattern = folder.uri.fsPath.replace("\\", "/") + "/" + testDirectoryGlob;
            logger_1.Logger.Log(`Finding projects for pattern ${globPattern}`);
            const matchingDirsForWorkspaceFolder = glob.sync(globPattern);
            matchingDirs.push(...matchingDirsForWorkspaceFolder);
            logger_1.Logger.Log(`Found ${matchingDirsForWorkspaceFolder.length} matches for pattern in folder ${folder.uri.fsPath}`);
        });
        matchingDirs.forEach((dir) => {
            logger_1.Logger.Log(`Evaluating match ${dir}`);
            this.evaluateTestDirectory(dir);
        });
    }
    addTestsForDirectory(testsForDirectory) {
        this.testsForDirectory = this.testsForDirectory.concat(testsForDirectory);
    }
    clearTestsForDirectory() {
        this.testsForDirectory = [];
    }
    getFirstTestForDirectory(directory) {
        return this
            .testsForDirectory
            .find((t) => t.dir === directory).name;
    }
    getTestDirectories(testName) {
        if (testName && testName !== "") {
            const dirForTestName = this
                .testsForDirectory
                .filter((t) => t.name.startsWith(testName))
                .map((t) => t.dir);
            return [...new Set(dirForTestName)];
        }
        return this.directories;
    }
    removeTestDirectory(directory) {
        this.directories = this.directories.filter((dir) => dir !== directory);
        logger_1.Logger.LogWarning(`Removed directory ${directory} due to it not containting any tests`);
    }
    evaluateTestDirectory(testProjectFullPath) {
        if (!fs.existsSync(testProjectFullPath)) {
            logger_1.Logger.LogWarning(`Path ${testProjectFullPath} is not valid`);
        }
        else {
            if (fs.lstatSync(testProjectFullPath).isFile()) {
                testProjectFullPath = path.dirname(testProjectFullPath);
            }
            if (glob.sync(`${testProjectFullPath}/+(*.csproj|*.sln|*.fsproj)`).length < 1) {
                logger_1.Logger.LogWarning(`Skipping path ${testProjectFullPath} since it does not contain something we can build (.sln, .csproj, .fsproj)`);
            }
            else {
                logger_1.Logger.Log(`Adding directory ${testProjectFullPath}`);
                this.directories.push(testProjectFullPath);
            }
        }
    }
}
exports.TestDirectories = TestDirectories;
//# sourceMappingURL=testDirectories.js.map