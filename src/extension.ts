import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// TrieNode represents each node in the Trie data structure
class TrieNode {
    children: { [key: string]: TrieNode } = {}; // Maps each character to its corresponding TrieNode
    isEndOfWord: boolean = false; // Indicates if the node represents the end of a word
    urls: Set<string> = new Set(); // Stores URLs that share this prefix
}

// Trie data structure for efficient prefix-based search
class Trie {
    root: TrieNode = new TrieNode();

    // Insert a word into the Trie along with its associated URL
    insert(word: string, originalUrl: string) {
        let node = this.root;
        for (const char of word) {
            if (!(char in node.children)) {
                node.children[char] = new TrieNode();
            }
            node = node.children[char];
            node.urls.add(originalUrl); // Add URL to the set of URLs for the current prefix
        }
        node.isEndOfWord = true; // Mark the end of the word
    }

    // Search for all URLs matching a given prefix
    searchPrefix(prefix: string): string[] {
        let node = this.root;
        for (const char of prefix) {
            if (!(char in node.children)) {
                return []; // Return empty array if prefix not found
            }
            node = node.children[char];
        }
        return Array.from(node.urls); // Return all URLs associated with the prefix
    }
}

// Create a Trie from a list of URLs
function createTrie(urls: string[]): Trie {
    const trie = new Trie();
    for (const url of urls) {
        const partAfterQuestionMark = url.split('?', 2)[1] || "";
        trie.insert(partAfterQuestionMark, url);
    }
    return trie;
}

// Create an import statement from a URL
function createImportStatement(url: string): string {
    const urlParts = url.split('?');
    if (urlParts.length < 3) {
        return '';
    }
    const modulePath = urlParts[0].replace('http://mathhub.info/', '').replace('/mod', '');
    const moduleName = `mod?${urlParts[1]}`;
    return `\\importmodule[${modulePath}]{${moduleName}}`;
}

// Extract the part of the URL after the last question mark
function extractAfterLastQuestionMark(url: string): string {
    const lastQuestionMarkIndex = url.lastIndexOf('?');
    return url.substring(lastQuestionMarkIndex + 1);
}

// Activate the extension
export function activate(context: vscode.ExtensionContext) {
    console.log("Initializing");

    // Load strings from url.json
    const filePath = path.join(context.extensionPath, 'url.json');
    const urls: string[] = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // Create trie from URLs
    const trie = createTrie(urls);

    // Register a completion item provider for LaTeX files
    const provider = vscode.languages.registerCompletionItemProvider('latex', {
        provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext) {
            const linePrefix = document.lineAt(position).text.substr(0, position.character);
            const prefixMatch = linePrefix.match(/\\sr\{(\w*)$/);

            if (!prefixMatch) {
                return undefined;
            }

            const prefix = prefixMatch[1];
            console.log("Searching for prefix:", prefix);

            // Get suggestions from the Trie
            const suggestions = trie.searchPrefix(prefix);
            return suggestions.map(url => {
                const importStatement = createImportStatement(url);
                const detail = importStatement.replace('\\importmodule', ''); // Remove the \importmodule part

                const suggestionText = extractAfterLastQuestionMark(url);
                const completionItem = new vscode.CompletionItem(suggestionText, vscode.CompletionItemKind.Module);
                completionItem.insertText = suggestionText;

                // Use the detail property to show additional information in faded color
                completionItem.detail = `${detail.trim()}`;

                // Add the import statement to be triggered on selection
                completionItem.command = {
                    command: 'extension.insertImportStatement',
                    title: 'Insert Import Statement',
                    arguments: [importStatement]
                };
                return completionItem;
            });
        }
    }, '{');

    context.subscriptions.push(provider);

    // Register the command to insert the import statement
    const insertImportStatementCommand = vscode.commands.registerCommand('extension.insertImportStatement', (importStatement: string) => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const documentText = editor.document.getText();

            // Check if the import statement already exists
            if (!documentText.includes(importStatement)) {
                editor.edit(editBuilder => {
                    // Insert at the top of the document (after \begin{document})
                    const documentStart = documentText.indexOf('\\begin{document}');
                    if (documentStart !== -1) {
                        const insertPosition = editor.document.positionAt(documentStart + '\\begin{document}'.length);
                        // Move the insert position to the next line
                        const nextLinePosition = insertPosition.with(insertPosition.line + 1, 0);
                        editBuilder.insert(nextLinePosition, `${importStatement}\n`);
                    }
                });
            } else {
                vscode.window.showInformationMessage('This module is already imported.');
            }
        }
    });

    context.subscriptions.push(insertImportStatementCommand);
}

// Deactivate the extension
export function deactivate() {}
