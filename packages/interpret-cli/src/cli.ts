#!/usr/bin/env node
import program from "commander";
import debug from "debug";
import { readFile, writeFile } from "fs-extra";
/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import klaw from "klaw";
import prettier from "prettier";
import Config from "./config";
import { extra } from "./ext";
import { Request } from "./request";
import { to } from "./to";

const packageInfo = require("../package.json");
const log = debug("j2t:cli");
program
  .version(packageInfo.version)
  .usage("-c dubbo.json")
  .option("-c, --config [value]", "specify interpret Config ")
  .usage("-a --auto-read-maven-pkg")
  .option("-a --auto-read-maven-pkg", "read config info from maven' pom.xml")
  .parse(process.argv);

(async () => {
  const dubboConfig = await Config.fromConfigPath(
    program.config
  );

  if (program.autoReadMavenPkg) {
    const fs = require("fs");
    const path = require("path");
    const parser = require("xml2json");

    let cwdPath = process.cwd();
    const mavenPkgDescFilePath = path.resolve(cwdPath, "pom.xml");
    if (!fs.existsSync(mavenPkgDescFilePath)) {
      throw new Error('can\'t find pom.xml!');
    }

    const xmlString = fs.readFileSync(path.resolve(process.cwd(), "pom.xml"), "utf-8");
    let {project} = parser.toJson(xmlString, { object: true });
    dubboConfig.entryJarPath = path.resolve(cwdPath, `target/${project.artifactId}-${project.version}.jar`);
    dubboConfig.output = path.resolve(cwdPath, `target/${project.artifactId}-${project.version}-ts`);
    dubboConfig.providerSuffix = "Service";
    dubboConfig.libDirPath = path.resolve(cwdPath, `target/dependency`);
  }

  const { res: extInfo, err: extError } = await to(extra(dubboConfig));
  if (extError) {
    console.error("Failed to extract ast from java class");
    console.log(extError);
    log(extError);
    return;
  }

  //setup jar ast path
  console.log("read jar ast file", extInfo.jarInfo);
  dubboConfig.jarInfo = extInfo.jarInfo;
  log(`parse config->${JSON.stringify(dubboConfig, null, 2)}`);
  await new Request(dubboConfig).work();
  await formatSourceDir(dubboConfig.output);
  // todo: 生成 npm package
  console.log("Translation completed");
})();

/**
 * Format the source code
 * @param srcDir
 * @returns {Promise}
 */
async function formatSourceDir(srcDir): Promise<void> {
  log(`Format the source code:${srcDir}`);
  return new Promise<void>((resolve, reject) => {
    klaw(srcDir)
      .on("data", async (item: klaw.Item) => {
        if (item.path.endsWith(".ts")) {
          try {
            let fileContent = await readFile(item.path);
            await writeFile(
              item.path,
              prettier.format(fileContent.toString(), {
                parser: "typescript",
                singleQuote: true,
                bracketSpacing: false,
                trailingComma: "all",
                semi: true
              })
            );
            log(`Format the source code successfully:${item.path}`);
          } catch (err) {
            log(`Failed to format the source code:${item.path} ${err}`);
            console.warn(
              `Failed to format the source code:${item.path} ${err}`
            );
            reject(err);
          }
        }
      })
      .on("end", () => {
        resolve();
      });
  });
}

process.on("uncaughtException", err => {
  console.log(err);
});

process.on("unhandledRejection", err => {
  console.log(err);
});
