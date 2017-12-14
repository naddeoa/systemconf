import * as report from './report';
import * as command from './command';

export function executeInstall(env: command.Environment, reportOutput: report.Report): report.ResultReport {
    const results = reportOutput.willBeInstalled.map(commandScheme => command.install(env, commandScheme));

    return {
        success: results.filter(result => result.status === "success"),
        failure: results.filter(result => result.status === "failure"),
    }
}