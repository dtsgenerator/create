import path from 'path';
import spawn from 'cross-spawn';
import * as fs from 'fs-extra';
import mustache from 'mustache';

let projectName: string | undefined;

async function parseArgs() {
    const { Command } = await import('commander');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const packageJson: {
        name: string;
        version: string;
    } = await fs.readJson(path.resolve(__dirname, '../package.json'));

    return new Command(packageJson.name)
        .version(packageJson.version)
        .arguments('<project-name>')
        .usage('<project-name> [options]')
        .action((name: string) => {
            projectName = name;
        })
        .option('--verbose', 'print additional logs')
        .allowExcessArguments()
        .parse(process.argv);
}

function checkPrivateProject(name: string): boolean {
    return name.startsWith('@');
}

function addPrefix(name: string): string {
    const m = /^(?<prefix>@?dtsgenerator(?:-|\/)?)?(?<content>.+)$/.exec(name);
    if (m == null) {
        console.log('What!?');
        process.exit(255);
    }
    const prefix = m.groups?.prefix;
    const content = m.groups?.content ?? '';
    if (prefix != null && checkPrivateProject(prefix)) {
        return '@dtsgenerator/' + content;
    }
    return 'dtsgenerator-' + content;
}
async function checkProjectName(name: string): Promise<string> {
    const { default: validate } = await import('validate-npm-package-name');
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
    targetDir: string,
): Promise<void> {
    await fs.copy(
        path.resolve(path.join(__dirname, '../template/')),
        targetDir,
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

    console.log();
    console.log('  Finish to copy files.');
}
async function createPackageJson(
    name: string,
    targetDir: string,
): Promise<void> {
    const dtsgeneratorSpec = '^3.19.2';
    const eslintConfigSpec = '^1.0.0';
    const json: Record<string, unknown> = {
        name,
        version: '0.1.0',
        description: 'PLEASE CHANGE THIS DESCRIPTION!!!',
        main: 'index.js',
        scripts: {
            clean: 'rimraf index.js test/**/*.js *.tsbuildinfo',
            format: "prettier --check 'index.ts' 'test/*.ts'",
            'format:fix': "prettier --write 'index.ts' 'test/*.ts'",
            lint: "eslint 'index.ts' 'test/*.ts'",
            'lint:fix': "eslint --fix 'index.ts' 'test/*.ts'",
            fix: 'npm run format:fix && npm run lint:fix',
            compile: 'tsc -p .',
            build: 'npm run compile',
            'do-test':
                'cross-env TS_NODE_FILES=true mocha --exit --require ts-node/register --colors test/*_test.ts',
            test: 'nyc npm run do-test',
            coverage: 'nyc report --reporter=lcov',
            'test:update-snapshot': 'UPDATE_SNAPSHOT=1 npm run do-test',
            prepare: 'husky',
        },
        keywords: ['dtsgenerator', 'dtsgenerator-plugin'],
        engines: {
            node: '^22.22.2 || >=24.15.0',
        },
        peerDependencies: {
            dtsgenerator: dtsgeneratorSpec,
            tslib: '^2.8.1',
        },
        devDependencies: {
            '@dtsgenerator/eslint-config': eslintConfigSpec,
            '@types/mocha': '^10.0.10',
            '@types/node': '^22.20.1',
            'cross-env': '^10.1.0',
            dtsgenerator: dtsgeneratorSpec,
            eslint: '^10.10.0',
            husky: '^9.1.7',
            'lint-staged': '^17.5.0',
            mocha: '^12.0.0',
            nyc: '^18.0.0',
            prettier: '^3.9.6',
            rimraf: '^6.1.3',
            'ts-node': '^10.9.2',
            tslib: '^2.8.1',
            typescript: '^6.0.3',
        },
        'lint-staged': {
            '**/*.ts': ['prettier --write', 'eslint --fix'],
        },
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
                reject(`${command} ${args.join(' ')}`);
                return;
            }
            resolve();
        });
    });
}
async function installDependencies(targetDir: string): Promise<void> {
    const originalDir = process.cwd();
    process.chdir(targetDir);
    try {
        console.log('  Start git init.');
        await callCommand('git', ['init']);

        console.log();
        console.log('  Start to install dependencies from npm.');
        await callCommand('npm', ['install', '--loglevel', 'error']);
    } finally {
        process.chdir(originalDir);
    }
}

async function main(): Promise<void> {
    try {
        const program = await parseArgs();
        // const verbose: boolean = program.verbose;

        if (projectName == null) {
            console.log();
            console.log(program.helpInformation());
            process.exit(1);
        }
        projectName = await checkProjectName(addPrefix(projectName));
        console.log('Start to create project: ' + projectName);

        const targetDir = checkTargetDirectory(projectName);
        await copyTemplateFiles(projectName, targetDir);
        await createPackageJson(projectName, targetDir);
        await installDependencies(targetDir);

        console.log('Finish to create project.');
        console.log(
            `  Please open and edit ${path.relative('.', targetDir)}/index.ts.`,
        );
    } catch (reason: unknown) {
        console.log();
        if (typeof reason === 'string') {
            console.log(`  '${reason}' has failed.`);
        } else {
            console.log('  Unexpected error.');
            console.log(reason);
        }
        console.log();
    }
}
void main();
