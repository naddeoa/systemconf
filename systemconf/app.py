from dataclasses import dataclass, field
import time
from typing import Any, Dict, Generator, List, cast

from progress_table.symbols import SymbolsUnicodeBare
from systemconf.ast_util import get_dependencies, get_executable_index, get_recipe_definition_index, get_zero_dependency_targets
from systemconf.dependencies import bfs_iterator, get_dependency_graph
from systemconf.execute import SystemconfData, check_target_status, install_target
from systemconf.parser import parse
from systemconf.types import Executable, RecipeInvocation
from systemconf.validation import validate

from progress_table import ProgressTable

# Monkeypatch SymbolsUnicodeBare.embedded_pbar_filled to be -
# SymbolsUnicodeBare.embedded_pbar_filled = "─"


@dataclass
class StatusResult:
    missing: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    installed: List[str] = field(default_factory=list)


class App:
    def __init__(self, config_path: str) -> None:
        self.config_path = config_path
        self.data = self.setup()

    def setup(self) -> SystemconfData:
        """
        Parse the config file and create all of the indexes that we'll need to execute the systemconf.
        Also runs validation.
        """
        with open(self.config_path) as f:
            config = f.read()

        ast = parse(config)
        executables = get_executable_index(ast)
        dependencies = get_dependencies(ast, executables)
        G = get_dependency_graph(dependencies)
        recipes = get_recipe_definition_index(ast)
        conf = SystemconfData(execution_index=executables, recipe_index=recipes, G=G, ast=ast, dependency_index=dependencies)
        validate(conf)
        return conf

    def list_targets(self) -> None:
        """
        List all targets in the systemconf.
        """

        # for target in self.data.execution_index.keys():
        # print(target)

        for target in bfs_iterator(self.data.G):
            print(target)

    def list_dependencies(self) -> None:
        """
        List all targets with their dependencies
        """

        largest_target_name = max([len(t) for t in self.data.execution_index.keys()])
        dependency_strings: Dict[str, str] = {
            target: ", ".join(deps) if deps else "-" for target, deps in self.data.dependency_index.items()
        }
        largest_dependency_name = max([len(t) for t in dependency_strings.values()])

        table = ProgressTable()
        table.add_column("target", width=largest_target_name)  # type: ignore[reportUnknownMemberType]
        table.add_column("dependencies", width=largest_dependency_name)  # type: ignore[reportUnknownMemberType]

        for target in bfs_iterator(self.data.G):
            deps_string = dependency_strings[target]
            table["target"] = target
            table["dependencies"] = deps_string
            table.next_row()

        table.close()

    def ls(self) -> None:
        zero_deps = get_zero_dependency_targets(self.data.dependency_index)
        for target in bfs_iterator(self.data.G, zero_deps[0]):
            deps = self.data.dependency_index[target]
            deps_string = ", ".join(deps)
            exec = self.data.execution_index[target]

            # Print out target/dependencies
            print(target)
            print(f"  ↳ Dependencies: {deps_string}")

            # Summarize how the target is installed
            if "recipe" in exec:
                recipe = exec["recipe"]
                for reipe_or_shell in recipe:
                    print(f"  ↳ Recipe: {reipe_or_shell}")

    def status(self) -> StatusResult:
        """
        List the install status of each target
        """
        largest_target_name = max([len(t) for t in self.data.execution_index.keys()])
        dependency_strings: Dict[str, str] = {
            target: ", ".join(deps) if deps else "-" for target, deps in self.data.dependency_index.items()
        }
        largest_dependency_name = max([len(t) for t in dependency_strings.values()])

        table = ProgressTable(default_column_alignment="left", table_style="bare", embedded_progress_bar=True)
        table.add_column("target", width=largest_target_name + 2)  # type: ignore[reportUnknownMemberType]
        table.add_column("dependencies", width=largest_dependency_name + 2)  # type: ignore[reportUnknownMemberType]
        table.add_column("status", width=15)  # type: ignore[reportUnknownMemberType]
        table.add_column("details", width=60)  # type: ignore[reportUnknownMemberType]

        prog: Generator[str, Any, None] = cast(Generator[str, Any, None], table(bfs_iterator(self.data.G)))
        status_result = StatusResult()
        for target in prog:
            deps_string = dependency_strings[target]
            table["target"] = target
            table["dependencies"] = deps_string

            time.sleep(0.01)
            table["status"] = "🟡 Checking..."
            time.sleep(0.01)

            result = check_target_status(self.data, target)

            if result is None:
                table["status"] = "🟢 Installed"
                status_result.installed.append(target)
            else:
                if result.returncode == 1:
                    table["status"] = "🟡 Not installed"
                    table["details"] = result.stdout
                    status_result.missing.append(target)
                else:
                    # TODO send PR to library to fix the formatting with unicode/emoji. Length is wrong.
                    table["status"] = "🔴 Error"
                    table["details"] = result.stderr.strip()
                    status_result.errors.append(target)

            table.next_row()

        table.close()
        return status_result

    def install_missing(self, status_result: StatusResult) -> None:
        """
        Install all missing targets
        """
        largest_target_name = max([len(t) for t in status_result.missing])

        table = ProgressTable(default_column_alignment="left", table_style="bare", embedded_progress_bar=True, refresh_rate=100)
        table.add_column("target", width=largest_target_name + 2)  # type: ignore[reportUnknownMemberType]
        table.add_column("status", width=15)  # type: ignore[reportUnknownMemberType]
        table.add_column("details", width=100)  # type: ignore[reportUnknownMemberType]
        missing_packages = set(status_result.missing)

        prog: Generator[str, Any, None] = cast(Generator[str, Any, None], table(bfs_iterator(self.data.G)))
        for target in prog:
            # TODO skip the target install if any of its dependencies failed install
            if target not in missing_packages:
                continue

            table["target"] = target
            exec = self.data.execution_index[target]

            time.sleep(0.01)
            table["status"] = "🟡 Installing..."
            time.sleep(0.01)
            table["details"] = self._display_setup(exec)
            time.sleep(0.01)

            result = install_target(self.data, target)
            if result is None:
                table["status"] = "🟢 Installed"
            else:
                if result.returncode == 1:
                    table["status"] = "🟡 Not installed"
                    table["details"] = result.stdout.strip().replace("\n", " ")
                else:
                    table["status"] = "🔴 Error"
                    table["details"] = result.stderr.strip().replace("\n", " ")
            table.next_row()

        table.close()

    def _display_setup(self, it: Dict[str, List[Executable]]) -> str:
        exec = it["setup"] if "setup" in it else it["recipe"]

        commands: List[str] = []
        for executable in exec:
            if isinstance(executable, RecipeInvocation):
                recipe = self.data.recipe_index[executable.name]
                commands.append("\n".join(recipe.get_setup_commands(executable.args, self.data.recipe_index)))
            else:
                commands.append(executable.command)

        # TODO what's the best way to display multiple commands? They're bound to be too long. For now
        # I'll just show the first one and maybe append a "..." if there are more.
        return f"{commands[0]} {'...' if len(commands) > 1 else ''}"
