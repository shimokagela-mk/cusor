#!/usr/bin/env node
'use strict';

const path = require('path');

const suites = [
    ['scripts/validate-examples.js (CLI)', () => require('./tools.test').testValidateExamples()],
    ['scripts/check-api-references.js (CLI)', () => require('./tools.test').testCheckReferences()],
    ['negative.test.js', () => {
        const m = require('./negative.test');
        m.runNegativeSchemaCases();
        m.runNegativeSpecialCases();
    }],
    ['tools.test.js', () => {
        const m = require('./tools.test');
        m.testNewGeneratesValidScript();
        m.testNewExtensionGeneratesDirectory();
        m.testConvertRoundTrip();
        m.testConvertJsonContentDeserializesEscapes();
        m.testConvertInfersProjectContext();
        m.testConvertDoesNotUseOtherProjectMetadata();
        m.testConvertRequiresOutForArchiveInput();
        m.testVerifyProject();
        m.testExpandJsStringLiterals();
        m.testUnpackProjectCreatesTavernHelperForJsOnly();
        m.testUnpackProjectCreatesTavernHelperForScriptPair();
        m.testUnpackProjectCreatesRegexAsset();
        m.testUnpackProjectRejectsProfileOption();
        m.testPackProjectArchivesAndUsesAssetRoots();
        m.testVerifyProjectRejectsLegacyRootSrc();
        m.testVerifyProjectRejectsUnknownAssetRoot();
    }],
];

function main() {
    let failed = 0;
    for (const [name, fn] of suites) {
        try {
            fn();
            console.log(`  ✓ ${name}`);
        } catch (error) {
            failed++;
            console.error(`  ✗ ${name}: ${error.message}`);
            if (process.env.DEBUG) console.error(error.stack);
        }
    }
    if (failed) {
        console.error(`[失败] ${failed} / ${suites.length} 个套件未通过`);
        process.exit(1);
    }
    console.log(`[通过] ${suites.length} / ${suites.length} 个测试套件全部通过`);
}

if (require.main === module) main();
