const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const cli = path.resolve(__dirname, '../bin/create.js');

function runCreate(cwd, args) {
    const npmBin = fs.mkdtempSync(
        path.join(os.tmpdir(), 'dtsgenerator-create-npm-'),
    );
    const npmPath = path.join(npmBin, 'npm');
    fs.writeFileSync(npmPath, '#!/bin/sh\nexit 0\n');
    fs.chmodSync(npmPath, 0o755);
    try {
        return spawnSync(process.execPath, [cli, ...args], {
            cwd,
            encoding: 'utf8',
            env: {
                ...process.env,
                PATH: `${npmBin}${path.delimiter}${process.env.PATH}`,
            },
        });
    } finally {
        fs.rmSync(npmBin, { force: true, recursive: true });
    }
}

function withTemporaryDirectory(callback) {
    const directory = fs.mkdtempSync(
        path.join(os.tmpdir(), 'dtsgenerator-create-'),
    );
    try {
        callback(directory);
    } finally {
        fs.rmSync(directory, { force: true, recursive: true });
    }
}

test('preserves the CLI help contract', () => {
    const result = runCreate(process.cwd(), ['--help']);

    assert.equal(result.status, 0);
    assert.equal(
        result.stdout,
        `Usage: @dtsgenerator/create <project-name> [options]

Options:
  -V, --version  output the version number
  --verbose      print additional logs
  -h, --help     display help for command
`,
    );
});

test('preserves the missing argument help and exit status', () => {
    const result = runCreate(process.cwd(), []);

    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.equal(
        result.stderr,
        "error: missing required argument 'project-name'\n",
    );
});

test('continues to ignore excess positional arguments', () => {
    withTemporaryDirectory((directory) => {
        const result = runCreate(directory, ['first', 'second']);

        assert.equal(result.status, 0, result.stderr);
        assert.equal(
            fs.existsSync(
                path.join(directory, 'dtsgenerator-first/package.json'),
            ),
            true,
        );
    });
});

test('creates the default prefixed project with pinned compatible dependencies', () => {
    withTemporaryDirectory((directory) => {
        const result = runCreate(directory, ['sample']);
        const target = path.join(directory, 'dtsgenerator-sample');

        assert.equal(result.status, 0, result.stderr);
        assert.match(
            result.stdout,
            /Start to create project: dtsgenerator-sample/,
        );
        const packageJson = JSON.parse(
            fs.readFileSync(path.join(target, 'package.json'), 'utf8'),
        );
        assert.equal(packageJson.name, 'dtsgenerator-sample');
        assert.equal(packageJson.engines.node, '^22.22.2 || >=24.15.0');
        assert.equal(packageJson.peerDependencies.dtsgenerator, '^4.0.0');
        assert.equal(packageJson.devDependencies.typescript, '^6.0.3');
        assert.equal(
            packageJson.devDependencies['@dtsgenerator/eslint-config'],
            '^1.0.0',
        );
        assert.equal(
            fs.existsSync(path.join(target, 'eslint.config.cjs')),
            true,
        );
        assert.equal(fs.existsSync(path.join(target, '.eslintrc.json')), false);
        assert.equal(
            fs.readFileSync(path.join(target, '.husky/pre-commit'), 'utf8'),
            'npx lint-staged\n',
        );
    });
});

test('preserves scoped dtsgenerator package names', () => {
    withTemporaryDirectory((directory) => {
        const result = runCreate(directory, ['@dtsgenerator/scoped']);
        const packageJson = JSON.parse(
            fs.readFileSync(
                path.join(directory, 'scoped/package.json'),
                'utf8',
            ),
        );

        assert.equal(result.status, 0, result.stderr);
        assert.equal(packageJson.name, '@dtsgenerator/scoped');
        assert.deepEqual(packageJson.publishConfig, { access: 'public' });
    });
});

test('rejects invalid package names', () => {
    withTemporaryDirectory((directory) => {
        const result = runCreate(directory, ['bad name']);

        assert.equal(result.status, 1);
        assert.match(
            result.stdout,
            /<project-name>\(dtsgenerator-bad name\) is invalid\./,
        );
    });
});

test('rejects an existing target directory', () => {
    withTemporaryDirectory((directory) => {
        fs.mkdirSync(path.join(directory, 'dtsgenerator-existing'));
        const result = runCreate(directory, ['existing']);

        assert.equal(result.status, 2);
        assert.match(
            result.stdout,
            /The directory \(dtsgenerator-existing\) is already exists\./,
        );
    });
});
