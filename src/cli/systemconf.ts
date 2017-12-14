#!/usr/bin/env node
import * as program from "commander";

const packageJson = require('../../package.json');

program
    .version(packageJson.version)
    .description("Install and remove programs according to a single configuration file.")
    .command("install <configFile>", "Install programs according to the configuration file.")
    .parse(process.argv);
