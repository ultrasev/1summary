import { PROMPT as DEFAULT_PROMPT } from './config.js';

export function llm(content, onChunk) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(['provider', 'providers'], function (result) {
            const provider = result.provider || 'default';
            const providers = result.providers || {};
            const settings = providers[provider] || {};

            const appKey = settings.appKey || '';
            const apiUrl = settings.apiUrl || '';
            const model = settings.model || '';
            const prompt = settings.prompt || DEFAULT_PROMPT;
            const temperature = parseFloat(settings.temperature) || 0.7;

            if (!appKey || !apiUrl || !model) {
                reject(new Error('Missing required settings: API Key, API URL, or Model'));
                return;
            }

            fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${appKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: "system", content: prompt },
                        { role: "user", content: content }
                    ],
                    temperature: temperature,
                    stream: true
                })
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.body.getReader();
                })
                .then(reader => {
                    const decoder = new TextDecoder("utf-8");
                    function readChunk() {
                        return reader.read().then(({ done, value }) => {
                            if (done) {
                                resolve();
                                return;
                            }
                            const chunk = decoder.decode(value);
                            const lines = chunk.split("\n");
                            const parsedLines = lines
                                .map(line => line.replace(/^data: /, "").trim())
                                .filter(line => line !== "" && line !== "[DONE]")
                                .map(line => {
                                    try {
                                        return JSON.parse(line);
                                    } catch (error) {
                                        return {
                                            choices: [
                                                {
                                                    delta: {
                                                        content: line
                                                    }
                                                }
                                            ]
                                        };
                                    }
                                })
                                .filter(line => line !== null);

                            for (const parsedLine of parsedLines) {
                                const { choices } = parsedLine;
                                const { delta } = choices[0];
                                const { content } = delta;
                                if (content) {
                                    onChunk(content);
                                }
                            }
                            return readChunk();
                        });
                    }
                    return readChunk();
                })
                .catch(error => {
                    reject(error);
                });
        });
    });
}


export async function testLLMConnection() {
    try {
        const { provider, providers } = await new Promise((resolve) => {
            chrome.storage.local.get(['provider', 'providers'], resolve);
        });

        if (!provider || !providers || !providers[provider]) {
            throw new Error('Missing provider or provider settings');
        }

        const settings = providers[provider];
        const { appKey, apiUrl, model } = settings;

        if (!appKey || !apiUrl || !model) {
            throw new Error('Missing required settings: API Key, API URL, or Model');
        }

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${appKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: "user", content: "Hello" }],
                max_tokens: 5
            })
        });

        const responseData = await response.text();
        const details = {
            status: response.status,
            headers: Object.fromEntries(response.headers.entries()),
            data: responseData
        };

        if (!response.ok) {
            throw {
                message: `API request failed: ${response.statusText}`,
                details: details
            };
        }

        return { success: true, details: details };
    } catch (error) {
        return {
            error: error.message || 'An unknown error occurred',
            details: error.details || error
        };
    }
}