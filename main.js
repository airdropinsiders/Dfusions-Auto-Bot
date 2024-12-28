import path from 'path';
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import { fileURLToPath } from 'url';
import log from './utils/logger.js';
import banner from './utils/banner.js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import readline from 'readline';
import { solveAntiCaptcha } from './utils/solver.js';

const fileName = 'the-best-article-in-the-world';

async function askForApiKeys() {
    log.info(banner);
    const apiKeyFile = 'apikey.txt';

    if (fs.existsSync(apiKeyFile)) {
        log.info('API keys already exist. Continue running with existing keys.');
        return;
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    const question = (query) => new Promise((resolve) => rl.question(query, resolve));

    const geminiApiKey = await question('Please enter your Gemini API key: ');
    const antiCaptchaApiKey = await question('Please enter your Anti-Captcha API key: ');

    fs.writeFileSync(
        apiKeyFile,
        `Gemini_API_Key=${geminiApiKey}\nAntiCaptcha_API_Key=${antiCaptchaApiKey}\n`,
        'utf8'
    );

    log.info('Your API keys have been saved to "apikey.txt".');

    rl.close();
}


await askForApiKeys().catch(log.error);

const readFile = (path) => {
    try {
        const fileContent = fs.readFileSync(path, 'utf8');
        const files = fileContent
            .split('\n')
            .map(file => file.trim())
            .filter(file => file.length > 0);

        const keys = {};
        files.forEach(file => {
            const [key, value] = file.split('=');
            if (key && value) {
                keys[key.trim()] = value.trim();
            }
        });

        return keys;
    } catch (error) {
        log.error('Error reading the file:', error.message);
        return {};
    }
};

const allModel = ["gemini-1.5-flash", "gemini-1.0-pro"];
const keys = readFile('apikey.txt');
const geminiApiKey = keys['Gemini_API_Key'];
const antiCaptchaApiKey = keys['AntiCaptcha_API_Key'];

if (!geminiApiKey || !antiCaptchaApiKey) {
    log.error('API keys are missing or invalid. Please check "apikey.txt".');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(geminiApiKey);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


async function generateDocxArticle(randomTopic) {
    const aiModel = allModel[Math.floor(Math.random() * allModel.length)];
    const model = genAI.getGenerativeModel({ model: aiModel });

    const prompt = `Write article about ${randomTopic} as detailed as possible`

    const articles = await model.generateContent(prompt);
    const article = articles.response.text()

    const filePath = path.join(__dirname, `${fileName}.docx`);

    fs.writeFileSync(filePath, article, 'utf8');
    log.info(`Docx file generated successfully at ${filePath}`);

    return filePath;
}

async function fetchUserData(token, retries = 3) {
    try {
        const response = await axios.get('https://dfusion.app.cryptolock.ai/auth/user', {
            headers: {
                'authorization': `Bearer ${token}`,
            },
        });
        const userID = response?.data?.id || 'unknown';
        const points = response?.data?.points || 0;
        return { userID, points };
    } catch (error) {
        log.error('Error fetching user data:', error.message);
        if (retries > 0) {
            log.warn(`Retrying to fetch user info... Attempts left: ${retries}`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            return fetchUserUploads(token, retries - 1);
        } else {
            log.error('Max retries reached. Could not fetch user.');
            return { userID: 'unknown', points: 0 };
        }
    }
}
async function fetchUserUploads(token, retries = 3) {
    try {
        const response = await axios.get('https://dfusion.app.cryptolock.ai/api/contributions/uploads', {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });
        return response.data;
    } catch (error) {
        log.error('Error fetching user uploads:', error.message);

        if (retries > 0) {
            log.warn(`Retrying to fetch user uploads... Attempts left: ${retries}`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            return fetchUserUploads(token, retries - 1);
        } else {
            log.error('Max retries reached. Could not fetch user uploads.');
            return { error: error.message };
        }
    }
}

async function sendDocxFile(filePath, authToken, nameTopic, antiCaptchaApiKey, retries = 3) {
    const apiTokenURL = 'https://dfusion.app.cryptolock.ai/api/knowledge/submission-token';
    const apiEndpoint = 'https://dfusion.app.cryptolock.ai/api/knowledge/submissions/unknown';

    try {
        const tokenResponse = await axios.post(apiTokenURL,
            {
                fileNames: [nameTopic],
            },
            {
                headers: {
                    Authorization: `Bearer ${authToken}`,
                    'submission-token': await solveAntiCaptcha(antiCaptchaApiKey),
                },
            }
        );
        const submissionToken = tokenResponse.data.submission_token;
        if (!submissionToken) {
            throw new Error('Submission token not found');
        }

        async function uploadFile(retries = 3) {
            try {
                const form = new FormData();
                form.append('knowledge', fs.createReadStream(filePath), {
                    filename: nameTopic,
                });

                const response = await axios.post(apiEndpoint, form, {
                    headers: {
                        ...form.getHeaders(),
                        Authorization: `Bearer ${authToken}`,
                        'submission-token': submissionToken,
                    },
                });

                log.info('File uploaded successfully:', response.data);
            } catch (error) {
                if (retries > 0) {
                    log.error('Error uploading file:', error.response?.data || error.message);

                    await new Promise(resolve => setTimeout(resolve, 5000));
                    log.info(`Retrying file upload... Attempts left: ${retries}`);

                    await uploadFile(retries - 1);
                } else {
                    log.error('Max retries reached. Failed to upload file.');
                }
            }
        }

        await uploadFile();

    } catch (error) {
        if (retries > 0) {
            log.error('Error getting submission token:', error.response?.data || error.message);

            await new Promise(resolve => setTimeout(resolve, 5000));
            log.info(`Retrying submission token retrieval... Attempts left: ${retries}`);
            await sendDocxFile(filePath, authToken, nameTopic, antiCaptchaApiKey, retries - 1);
        } else {
            log.error('Max retries reached. Failed to get submission token.');
        }
    }
}

const readTokens = (path) => {
    try {
        const fileContent = fs.readFileSync(path, 'utf8');
        const tokens = fileContent
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        return tokens;
    } catch (error) {
        log.error('Error reading the tokens file:', error.message);
        return [];
    }
};

// Main function 
async function main() {
    const tokens = readTokens('tokens.txt');
    const topics = readTokens('topics.txt');

    if (tokens.length === 0) {
        log.error('No tokens found. Please check your files.');
        return;
    }

    while (true) {
        let counter = 1;
        for (const token of tokens) {
            try {
                const randomNumber = Math.floor(1000 + Math.random() * 9000);
                const userInfo = await fetchUserData(token);
                log.info(`User #${counter} - info:`, userInfo);

                const uploads = await fetchUserUploads(token);
                log.info('Total Uploading Files:', uploads.length);

                const randomTopic = topics[Math.floor(Math.random() * topics.length)];
                const nameTopic = `Article-${randomNumber}-${randomTopic.replace(/\s+/g, '-')}.docx`;
                log.info(`Generating File With Random topic: ${nameTopic}`);
                const filePath = await generateDocxArticle(randomTopic);

                log.info(`=== Uploading file for user #${counter} ===`);
                await sendDocxFile(filePath, token, nameTopic, antiCaptchaApiKey);
                log.info(`=== Santuy, Cooldowns 30 seconds before continue ===`);
                await new Promise(resolve => setTimeout(resolve, 30 * 1000));

                counter++;
            } catch (error) {
                log.error(`Error processing user #${counter}:`, error.message);
            }
        }
    }
}


// Run 
main();
