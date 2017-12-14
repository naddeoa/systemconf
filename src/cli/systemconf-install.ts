#!/usr/bin/env node
import * as command from "../lib/command";
import * as report from "../lib/report";
import * as execute from "../lib/execute";
import * as readline from "readline";
import * as config from "../config";
import * as program from "commander";

program
    .description("Install programs specified in the config file.")
    .usage("[options] <configFile>")
    .option("-y, --yes", "Automatically proceed without prompting for user input.")
    .parse(process.argv);

install(program.args[0]);

function install(configFile: string) {
    if(!configFile){
        console.log("No configuration file specified");
        process.exit(1);
    }

    // TODO generate this correctly
    const env: command.Environment = { os: "ubuntu" };

    console.log(`Parsing ${configFile}...`);
    const processedParses = config.getCommands(configFile);

    console.log("Seeing which scripts are already installed...");
    const reportOutput = report.generateInstallReport(env, processedParses);

    report.printInstallReport(env, reportOutput);

    if (reportOutput.willBeInstalled.length === 0) {
        return;
    }

    if(program.yes){
        executeAndReport(env, reportOutput);
    } else {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

        rl.question("proceed? [y/N]: ", answer => {

            if (answer === "y") {
                executeAndReport(env, reportOutput);
            } else {
                console.log("Exiting")
            }
            rl.close();
        });
    }
}

function executeAndReport(env: command.Environment, reportOutput: report.Report){
    const executeResults = execute.executeInstall(env, reportOutput);
    report.printResultReport(env, executeResults);
}