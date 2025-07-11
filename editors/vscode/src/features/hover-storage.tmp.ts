// Hover storage backed by a temporary directory in the file system

import * as vscode from "vscode";
import * as crypto from "crypto";
import { Uri } from "vscode";
import { base64Decode } from "../util";
import { HoverStorageDummyHandler } from "./hover-storage";

export class HoverTmpStorage {
  constructor(readonly context: vscode.ExtensionContext) {}

  async startHover() {
    // This is a "workspace wide" storage for temporary hover images
    if (this.context.storageUri) {
      const tmpImageDir = Uri.joinPath(this.context.storageUri, "tmp/hover-images/");
      try {
        const previousEntries = await vscode.workspace.fs.readDirectory(tmpImageDir);
        let deleted = 0;
        for (const [name, type] of previousEntries) {
          if (type === vscode.FileType.File) {
            deleted++;
            await vscode.workspace.fs.delete(Uri.joinPath(tmpImageDir, name));
          }
        }
        if (deleted > 0) {
          console.log(`Deleted ${deleted} hover images`);
        }
      } catch (_err) {
        // todo: handle errors safely
      }
      try {
        await vscode.workspace.fs.createDirectory(tmpImageDir);
        return new HoverStorageTmpFsHandler(Uri.joinPath(this.context.storageUri, "tmp/"));
      } catch (err) {
        // todo: handle errors safely
        console.error("Failed to create hover image directory:", err);
      }
    }

    return new HoverStorageDummyHandler();
  }
}

class HoverStorageTmpFsHandler {
  promises: PromiseLike<void>[] = [];

  constructor(readonly _baseUri: vscode.Uri) {}

  baseUri() {
    return this._baseUri;
  }

  storeImage(content: string) {
    const fs = vscode.workspace.fs;
    const hash = crypto.createHash("sha256").update(content).digest("hex");
    const tmpImagePath = `./hover-images/${hash}.svg`;
    const output = Uri.joinPath(this._baseUri, tmpImagePath);
    const outputContent = base64Decode(content);
    this.promises.push(fs.writeFile(output, Buffer.from(outputContent, "utf-8")));
    return tmpImagePath;
  }

  async finish() {
    await Promise.all(this.promises);
  }
}
