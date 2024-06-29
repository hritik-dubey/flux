#!/usr/bin/env node

import path from 'path'
import fs from 'fs/promises'
import crypto from 'crypto'
import chalk from 'chalk'
import { diffLines } from 'diff'
import { Command } from 'commander'
const program = new Command()
class Flux {
    constructor(repoPath = ".") {
        this.repoPath = path.join(repoPath, ".flux");
        this.objectPath = path.join(this.repoPath, "object");
        this.headPath = path.join(this.repoPath, "head");
        this.indexPath = path.join(this.repoPath, "index");
        this.init()
    }

    async init() {
        await fs.mkdir(this.objectPath, { recursive: true })
        try {
            await fs.writeFile(this.headPath, "", { flag: 'wx' })
            await fs.writeFile(this.indexPath, JSON.stringify([]), { flag: 'wx' })
        }
        catch (e) {
        }
    }
    hashObject(object) {
        return crypto.createHash('sha1').update(object, 'utf-8').digest('hex')
    }

    async addFile(fileToBeAdded) {
        try {
            const fileData = await fs.readFile(fileToBeAdded, { encoding: 'utf-8' });
            const fileHash = this.hashObject(fileData)
            const filePathInRepo = path.join(this.objectPath, `${fileHash}`)
            await fs.writeFile(filePathInRepo, JSON.stringify(fileData))
            await this.updateStagingArea(fileToBeAdded, fileHash)
        } catch (error) {
            console.log("add", error)
        }
    }
    async updateStagingArea(filePathInRepo, fileHash) {
        try {
            const index = JSON.parse(await fs.readFile(this.indexPath, { encoding: "utf-8" }))
            index.push({ path: filePathInRepo, hash: fileHash })
            await fs.writeFile(this.indexPath, JSON.stringify(index))
        } catch (error) {
            console.log("update", error)
        }
    }
    async commit(message) {
        try {
            const index = JSON.parse(await fs.readFile(this.indexPath, { encoding: "utf-8" }))
            const parentCommit = await this.currentHead()
            const commitData = {
                message,
                parent: parentCommit,
                Date: new Date().toISOString(),
                files: index
            }
            const commitHash = this.hashObject(JSON.stringify(commitData))
            console.log({ commitHash });
            let commitpathObj = path.join(this.objectPath, commitHash)
            await fs.writeFile(commitpathObj, JSON.stringify(commitData))
            await fs.writeFile(this.headPath, JSON.stringify(commitHash))
            await fs.writeFile(this.indexPath, JSON.stringify([]))
        }
        catch (e) {
            console.log("commit", e)
        }
    }

    async currentHead() {
        try {
            return await fs.readFile(this.headPath, { encoding: "utf-8" })
        } catch (error) {
            console.log("head", error)
            return null
        }
    }

    async log() {
        let parentCommit = await this.currentHead()
        while (parentCommit) {
            const filePathInRepo = path.join(this.objectPath, JSON.parse(parentCommit))
            let data = JSON.parse(await fs.readFile(filePathInRepo, { encoding: "utf-8" }))
            console.log(`date:${data.Date} message ${data.message}`)
            parentCommit = data.parent
        }
    }

    async showCommitDiff(comitHash) {
        try {
            let commitData = await this.getCommitData(comitHash);
            if (!commitData) {
                console.log("commit data not found")
                return;
            }
            for (let files of commitData.files) {
                const fileContent = await this.getFileContent(files.hash)
                if (commitData.parent) {
                    let parentData = await this.getCommitData(JSON.parse(commitData.parent))
                    let parentFileContent = await this.getParentContent(parentData, files.path)
                    if (parentFileContent) {
                        console.log("\nDiff")
                        const diff = diffLines(parentFileContent, fileContent)
                        diff.forEach(part => {
                            if (part.added) {
                                process.stdout.write(chalk.green("++"+part.value))
                            }
                            else if (part.removed) {
                                process.stdout.write(chalk.red("--",part.value))
                            }
                            else {
                                process.stdout.write(chalk.gray(part.value))
                            }
                            console.log()
                        })
                    }
                    else {
                        console.log("new file in the commit")
                        process.stdout.write(chalk.green("++" + fileContent))
                    }
                }
                else{
                    console.log("its your first commit")
                }
            }
        } catch (error) {
            console.log("Failed to read the commit hash", error)
            return null
        }
    }

    async getParentContent(parantComiitData, filePath) {
        const parentFile = parantComiitData.files.find(file => file.path === filePath)
        if (parentFile) {
            return await this.getFileContent(parentFile.hash)
        }
    }

    async getCommitData(commitHash) {
        const filePathInRepo = path.join(this.objectPath, commitHash)
        try {
            const readContent = JSON.parse(await fs.readFile(filePathInRepo, { encoding: "utf-8" }))
            return readContent
        } catch (e) {
            console.log("Failed to read the commit data")
            return null
        }
    }

    async getFileContent(fileHash) {
        const filePathInRepo = path.join(this.objectPath, fileHash)
        try {
            const readContent = JSON.parse(await fs.readFile(filePathInRepo, { encoding: "utf-8" }))
            return readContent
        } catch (e) {
            console.log("Failed to read the file data", e)
            return null
        }
    }
}

// (async () => {
//     const fluxObj = new Flux()
//     await fluxObj.addFile("a.txt")
//     // await fluxObj.addFile("b.txt")
//     // await fluxObj.addFile("c.txt")
//     await fluxObj.commit("third commit")
//     await fluxObj.log()
//     await fluxObj.showCommitDiff("45ade07ceaf8e443d2895b27a4aab35f4012b5e6")
// })()

program.command('init').action(async ()=>{
        const flux = new Flux()
})

program.command('add <file>').action(async (file) => {
    const flux = new Flux()
    await flux.addFile(file)
})

program.command('commit <message>').action(async (message) => {
    const flux = new Flux()
    await flux.commit(message)
})

program.command('log').action(async () => {
    const flux = new Flux()
    await flux.log()
})

program.command('show <commitHash>').action(async (commitHash) => {
    const flux = new Flux()
    await flux.showCommitDiff(commitHash)
})

program.parse(process.argv)