import commander from 'commander';
import validate from 'validate-npm-package-name';

let projectName: string | undefined;

function parseArgs(): commander.Command {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const packageJson = require('../package.json');

    return new commander.Command(packageJson.name)
        .version(packageJson.version)
        .arguments('<project-name>')
        .usage('<project-name> [options]')
        .action((name) => {
            projectName = name;
        })
        .option('--verbose', 'print additional logs')
        .parse(process.argv);
}

function addPrefix(name: string): string {
    const m = /^(?<prefix>@?dtsgenerator(?:-|\/)?)?(?<content>.+)$/.exec(name);
    if (m == null) {
        console.error('What!?');
        process.exit(255);
    }
    const prefix = m.groups?.['prefix'];
    const content = m.groups?.['content'] || '';
    if (prefix != null && prefix[0] === '@') {
        return '@dtsgenerator/' + content;
    }
    return 'dtsgenerator-' + content;
}
function checkProjectName(name: string | undefined): string {
    if (name == null) {
        console.log(program.helpInformation());
        process.exit(1);
    }
    name = addPrefix(name);
    const result = validate(name);
    if (!result.validForNewPackages) {
        console.error(`<project-name>(${name}) is invalid.`);
        if (result.errors != null) {
            result.errors.forEach((e) => console.error('  ' + e));
        }
        if (result.warnings != null) {
            result.warnings.forEach((w) => console.warn('  ' + w));
        }
        process.exit(1);
    }
    return name;
}

const program = parseArgs();
const verbose: boolean = program.verbose;

projectName = checkProjectName(projectName);

console.log(`Result: ${projectName} ${verbose ? '[verbose]' : ''}`);
