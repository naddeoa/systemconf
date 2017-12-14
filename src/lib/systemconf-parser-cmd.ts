import * as command from "./command";
import * as parseTypes from "../config/parse-types";

interface CmdFormat extends parseTypes.ParseResult {
    command : string;
    commandType : "install" | "uninstall" | "isInstalled"
}

type MergedCmdLine = {
    install : Array<[object | null, string]>;
    uninstall : Array<[object | null, string]>;
    isInstalled : Array<[object | null, string]>;
    priority: number;
}

/**
 * Mapping funciton to take cmd lines in systemconf config files and turn them into
 * CommandSchemas.
 * @param parseResults The results to convert into CommandSchemas.
 */
function cmdMapper(parseResults : parseTypes.ParseResult[]) : parseTypes.ProcessedParseResults {

    if(isCmdMapper(parseResults)){
        const partitionedByName : { [commandFormat: string] : MergedCmdLine} = parseResults.reduce( ( acc : { [commandFormat: string] : MergedCmdLine} , current: CmdFormat) => {
            // Get what has been merged so far for the given program name
            const mergedLinesForGivenCommand : MergedCmdLine = acc[ current.name ] || {install: [], uninstall: [], isInstalled: [], priority: current.order};

            // Get the array of (predicate, command) pairs that has been gathered so far for the command type (install, uninstall, or isInstalled)
            var mergedLinesForCommandType: Array<[object | null, string]>;
            // Weird hack around indexed object types. We can't describe an object with one of three keys so we need to use type guards to prove it.
            switch(current.commandType){
                case "install": 
                    mergedLinesForCommandType = mergedLinesForGivenCommand[current.commandType];
                    break;
                case "uninstall": 
                    mergedLinesForCommandType = mergedLinesForGivenCommand[current.commandType];
                    break;
                case "isInstalled": 
                    mergedLinesForCommandType = mergedLinesForGivenCommand[current.commandType];
                    break;
                default:
                    throw new TypeError("never happens");

            }
            // mergedLinesForCommandType : Array<[object | null, string]>  = mergedLinesForGivenCommand[current.commandType];
            mergedLinesForCommandType.push([current.predicate || null, current.command]);
            
            // Set it back in case this was the first one
            mergedLinesForGivenCommand[current.commandType] = mergedLinesForCommandType;

            acc[current.name] = mergedLinesForGivenCommand;
            return acc;
        }, {});

        // Turn each combined object into a CommandSchema
        const commandSchemas : command.CommandSchema[] =  Object.keys(partitionedByName).map(name => {
            return {
                name,
                install: partitionedByName[name].install,
                uninstall: partitionedByName[name].uninstall,
                isInstalled: partitionedByName[name].isInstalled,
                priority: partitionedByName[name].priority
            }
        });

        return {
            commandSchemas,
            errors : [],
            parseResults
        }
    }

    throw new TypeError(`The mapper for the cmd config format got some parses that it shouldn't have gotten: ${JSON.stringify(parseResults)}`);
}

/**
 * Type guard to make sure the stuff coming in is actually in the CmdFormat, not
 * just mistakenly prefixed with "cmd".
 * @param parseResults
 */
function isCmdMapper(parseResults : any[]) : parseResults is CmdFormat[] {
    return parseResults.filter(parseResult => parseResult.command && parseResult.commandType).length === parseResults.length;
}

const systemConfModule : parseTypes.SystemConfModule = {
    mapper : cmdMapper,
    format : "cmd"
}

export default systemConfModule;