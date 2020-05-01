import commander from 'commander';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJson = require('../package.json');

let projectName: string | undefined;

const program = new commander.Command(packageJson.name)
    .version(packageJson.version)
    .arguments('<project-name>')
    .usage('<project-name> [options]')
    .action((name) => {
        projectName = name;
    })
    .option('--verbose', 'print additional logs')
    .parse(process.argv);

if (projectName == null) {
    console.log(program.helpInformation());
    process.exit(1);
}

const verbose: boolean = program.verbose;

console.log(`Result: ${projectName} ${verbose ? '[verbose]' : ''}`);
