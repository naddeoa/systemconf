# Systemconf (alpha quality)

Systemconf is a system of managing installations on a computer. The motivation
behind this was to make setting up a new system easier and more centralized. I
often end up changing distributions or setting up new rigs and find myself doing
a lot of manual program installation that I'd rather not be doing.

## How it works

It depends on `.sysc` files which contain a small simple DSL that let you
specify different things you need installed and how they should be installed. A
sample has been included in `./sample.sysc`. Below are some examples of the
kinds of things that you can put into `.sysc` files.

```
# These lines say that they only apply if the current operating system is ubuntu.
# This is the primitive statement in sysc that others build on. It says how to
# install, uninstall, and test for install status. Here, brew is being installed.
cmd({"os": "ubuntu"}) brew: install -- echo | ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Linuxbrew/install/master/install)"
cmd({"os": "ubuntu"}) brew: uninstall -- sudo rm -f $(which brew)
cmd({"os": "ubuntu"}) brew: isInstalled -- which brew


# This is a convenience around installing brew packages
brew toilet: toilet

# Same with git. This will clone from the first argument to the second arguments location
git oh-my-zsh: https://github.com/robbyrussell/oh-my-zsh.git ~/.oh-my-zsh

# And same with apt for debian distributions.
apt({"os":"ubuntu"}) essentials: git vim vim-gnome zsh mosh

# And for symlinks
symlink vimrc: ~/linux-dotfiles/files/.vimrc ~/.vimrc
```

The actual grammar is the `.pegjs` file in this repo. Generally, each line is
composed of the following

    <command name>({<optional json predicate>}) <program name>: <stuff passed to the command parser>

There are a few command built in like brew, git, apt and symlinks. These are the
things that I need myself but Systemconf is designed to allow for commands to be
defined in other packages. In the future, there will be some naming convention
like `systemconf-command-xxx` that will enable different syntax in the `.sysc`
files.

## Building and running

```
npm install
npm run build

# Will print a help menu
node ./lib/cli/systemconf.js

# Will attempt to run an install using the sample .sysc file.
# It will give you the opportunity to say no to everything.
node ./lib/cli/systemconf.js install ./sample.sysc
```
