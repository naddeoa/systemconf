{
	var order = 0;
}

start = (comment / cmdLine / customLine / __ / unparsableLine)*

comment "comment" = "#" $[^\n]* "\n" {return null;}

cmdLine = "cmd" _ predicate:predicate? _ name:id _ ":" _ commandType:commandType _ "--" command:command _
	{
        return {commandFormat: "cmd", predicate: predicate || null, name, commandType, command, rest: "", tokens: [], order: order++};
    }

customLine = commandFormat:id _ predicate:predicate? _ name:id _ ":" _ rest:$[^\n]* _
    {
        const stripped = rest.replace(/^\s*/,'').replace(/\s*$/,'');
        const tokens = stripped === "" ? [] : rest.split(/\s+/);
        return {commandFormat, predicate: predicate || null, name, rest, tokens, order: order++};
    }

unparsableLine = rest:$[^\n]+
    {
        return {error: rest};
    }

commandType = "install" / "uninstall" / "isInstalled"

command = command:$[^\n]+ {return command;}

predicate = "(" json:$[^)]+ ")" { return JSON.parse(json);}

id = $[^ \t\n\r:;()]+

_ = [ \t\r]* {return null;}

__ = [ \t\n\r]+ {return null;}