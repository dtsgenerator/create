import commander from 'commander';
import validate from 'validate-npm-package-name';

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
const result = validate(projectName);
if (!result.validForNewPackages) {
    console.error('<project-name> is invalid.');
    if (result.errors != null) {
        result.errors.forEach((e) => console.error('  ' + e));
    }
    if (result.warnings != null) {
        result.warnings.forEach((w) => console.warn('  ' + w));
    }
    process.exit(1);
}

const verbose: boolean = program.verbose;

console.log(`Result: ${projectName} ${verbose ? '[verbose]' : ''}`);
