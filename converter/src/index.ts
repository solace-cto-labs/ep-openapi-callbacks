import L, { logger } from './common/logger.js';
import * as fs from "fs";
import { AsyncAPIDocumentInterface as AsyncAPIDocument, Parser as Parser } from '@asyncapi/parser';
import type { OpenAPI } from '@scalar/openapi-types';
import AsyncAPItoOASMapper from './AsyncAPItoOASMapper.js';
import * as yaml from 'js-yaml';
import { command, binary, run, option } from "cmd-ts";


export { logger } from './common/logger.js';
export * from './model/CallBackSubscription.js';



const convert = command({
    name: "convert",
    args: {
        readPath: option({
            long: 'input',
            short: 'i'
        }),
        writePath: option({
            long: 'output',
            short: 'o'
        })
    },
    async handler({ readPath, writePath }) {
        L.info('Starting API converter...');
        const fileContent = fs.readFileSync(readPath, 'utf-8');
        const parser = new Parser();
        const d: AsyncAPIDocument = (await ((new Parser()).parse(fileContent))).document;
        const openapi: OpenAPI.Document = AsyncAPItoOASMapper.convert(d);
        const output = yaml.dump(openapi);
        fs.writeFileSync(writePath, output, 'utf-8');
        //fs.writeFileSync(writePath, JSON.stringify(openapi), 'utf-8')
        // L.info(JSON.stringify(openapi));
    },
});



run(binary(convert), process.argv);

