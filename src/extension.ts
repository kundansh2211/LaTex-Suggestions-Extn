import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

class TrieNode {
    children: { [key: string]: TrieNode } = {};
    isEndOfWord: boolean = false;
    words: string[] = [];
}

class Trie {
    root: TrieNode = new TrieNode();

    insert(word: string, originalUrl: string) {
        let node = this.root;
        for (const char of word) {
            if (!(char in node.children)) {
                node.children[char] = new TrieNode();
            }
            node = node.children[char];
            node.words.push(originalUrl);
        }
        node.isEndOfWord = true;
    }

    searchPrefix(prefix: string): string[] {
        let node = this.root;
        for (const char of prefix) {
            if (!(char in node.children)) {
                return [];
            }
            node = node.children[char];
        }
        return node.words;
    }
}

function createTrie(urls: string[]): Trie {
    const trie = new Trie();
    for (const url of urls) {
        const partAfterQuestionMark = url.split('?', 2)[1] || "";
        trie.insert(partAfterQuestionMark, url);
    }
    return trie;
}

export function activate(context: vscode.ExtensionContext) {
    console.log("Initializing");

    // Load strings from unique_extracted_parts.json
    const filePath = path.join(context.extensionPath, 'unique_extracted_parts.json');
    const urls: string[] = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // Create trie from URLs
    const trie = createTrie(urls);

    const provider1 = vscode.languages.registerCompletionItemProvider('latex', {
        provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext) {
            const linePrefix = document.lineAt(position).text.substr(0, position.character);
            const prefixMatch = linePrefix.match(/(\w+)$/);
            if (!prefixMatch) {
                return undefined;
            }

            const prefix = prefixMatch[1];
            console.log("Searching for prefix:", prefix);

            const suggestions = trie.searchPrefix(prefix);
            return suggestions.map(url => {
                const completionItem = new vscode.CompletionItem(url, vscode.CompletionItemKind.Text);
                completionItem.insertText = url;
                return completionItem;
            });
        }
    });

    context.subscriptions.push(provider1);
}

export function deactivate() {}
