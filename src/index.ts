import commander from 'commander';
import fs from 'fs-extra';
import mustache from 'mustache';
import path from 'path';
import validate from 'validate-npm-package-name';
import spawn from 'cross-spawn';

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

function checkPrivateProject(name: string): boolean {
    return name[0] === '@';
}

function addPrefix(name: string): string {
    const m = /^(?<prefix>@?dtsgenerator(?:-|\/)?)?(?<content>.+)$/.exec(name);
    if (m == null) {
        console.log('What!?');
        process.exit(255);
    }
    const prefix = m.groups?.['prefix'];
    const content = m.groups?.['content'] || '';
    if (prefix != null && checkPrivateProject(prefix)) {
        return '@dtsgenerator/' + content;
    }
    return 'dtsgenerator-' + content;
}
function checkProjectName(name: string): string {
    const result = validate(name);
    if (!result.validForNewPackages) {
        console.log();
        console.log(`<project-name>(${name}) is invalid.`);
        if (result.errors != null) {
            result.errors.forEach((e) => console.log('  ' + e));
        }
        if (result.warnings != null) {
            result.warnings.forEach((w) => console.log('  ' + w));
        }
        process.exit(1);
    }
    return name;
}

function checkTargetDirectory(name: string): string {
    const basename = path.basename(name);
    const d = path.resolve(basename);
    if (fs.pathExistsSync(d)) {
        console.log();
        console.log(`  The directory (${basename}) is already exists.`);
        console.log(`  Please rename <project-name> or remove the directory.`);
        process.exit(2);
    }
    fs.mkdirpSync(d);
    console.log(`Created the directory: ${basename}`);
    return d;
}
async function copyTemplateFiles(
    projectName: string,
    targetDir: string
): Promise<void> {
    await fs.copy(
        path.resolve(path.join(__dirname, '../template/')),
        targetDir
    );

    const view = { projectName };
    const ext = '.mustache';
    const files = (await fs.readdir(targetDir)).filter((f) => f.endsWith(ext));
    for (const file of files) {
        const p = path.join(targetDir, file);
        const template = await fs.readFile(p, 'utf-8');
        const content = mustache.render(template, view);
        const outputPath = p.substr(0, p.length - ext.length);
        await fs.writeFile(outputPath, content, 'utf-8');
        await fs.unlink(p);
    }

    console.log('  Finish to copy files.');
}
async function createPackageJson(
    name: string,
    targetDir: string
): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = {
        name,
        version: '0.1.0',
        description: 'PLEASE CHANGE THIS DESCRIPTION!!!',
        main: 'index.js',
        scripts: {
            lint: 'eslint *.ts **/*.ts',
            'lint:fix': 'npm run lint -- --fix',
            precompile: 'npm run lint',
            compile: 'tsc -p .',
            watch: 'npm run compile -- -w',
            build: 'npm run compile',
            'do-test':
                'cross-env TS_NODE_FILES=true mocha --exit --require ts-node/register --colors test/*_test.ts',
            test: 'nyc npm run do-test',
            coverage: 'nyc report --reporter=text-lcov | coveralls',
            'test:update-snapshot': 'UPDATE_SNAPSHOT=1 npm run do-test',
        },
        keywords: ['dtsgenerator', 'dtsgenerator-plugin'],
    };
    if (checkPrivateProject(name)) {
        json.publishConfig = {
            access: 'public',
        };
    }
    await fs.writeJson(path.join(targetDir, 'package.json'), json, {
        spaces: 2,
    });
}
function callCommand(command: string, args: string[]): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const child = spawn(command, args, { stdio: 'inherit' });
        child.on('close', (code) => {
            if (code !== 0) {
                reject({
                    command: `${command} ${args.join(' ')}`,
                });
                return;
            }
            resolve();
        });
    });
}
async function installDependencies(targetDir: string): Promise<void> {
    const originalDir = process.cwd();
    const dependencies = ['tslib'];
    const devDependencies = [
        '@types/mocha',
        '@types/node',
        '@typescript-eslint/eslint-plugin',
        '@typescript-eslint/parser',
        'cross-env',
        'dtsgenerator',
        'eslint',
        'eslint-config-prettier',
        'eslint-plugin-prettier',
        'mocha',
        'nyc',
        'prettier',
        'ts-node',
        'typescript',
    ];

    console.log('  Start to install dependencies from npm.');
    process.chdir(targetDir);
    try {
        await callCommand(
            'npm',
            ['install', '--save', '--loglevel', 'error'].concat(dependencies)
        );
        await callCommand(
            'npm',
            ['install', '--save-dev', '--loglevel', 'error'].concat(
                devDependencies
            )
        );
    } finally {
        process.chdir(originalDir);
    }
}

async function main(): Promise<void> {
    try {
        const program = parseArgs();
        // const verbose: boolean = program.verbose;

        if (projectName == null) {
            console.log();
            console.log(program.helpInformation());
            process.exit(1);
        }
        projectName = checkProjectName(addPrefix(projectName));
        console.log('Start to create project: ' + projectName);

        const targetDir = checkTargetDirectory(projectName);
        await copyTemplateFiles(projectName, targetDir);
        await createPackageJson(projectName, targetDir);
        await installDependencies(targetDir);

        console.log('Finish to create project.');
        console.log(
            `  Please open and edit ${path.relative('.', targetDir)}/index.ts.`
        );
    } catch (reason) {
        console.log();
        if (reason.command) {
            console.log(`  ${reason.command} has failed.`);
        } else {
            console.log('  Unexpected error.');
            console.log(reason);
        }
        console.log();
    }
}
main();
