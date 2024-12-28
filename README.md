# Dfusions Auto Generate and upload files
![banner](image.png)

This script automates generate files and upload it to dfussions dashboard.

## Features

- **Auto Generate files**
- **Auto Upload Files**
- **Support multiple accounts**

## Prerequisites

- Node.js installed on your machine
- gemini apikey you can get one here: https://aistudio.google.com/app/apikey
- anti-captcha apikey you can get it here: https://anti-captcha.com/clients/settings/apisetup
- dfusions token: register here [https://genesis.dfusion.ai](https://genesis.dfusion.ai?r=qduj8tgj)
- inspect or F12 if you already login, find Application and copy jwt value.
    ![token](image-1.png)

## Installation

1. Clone the repository:
    ```sh
    git clone https://github.com/airdropinsiders/Dfusions-Auto-Bot.git
    cd Dfusions-Auto-Bot
    ```

2. Install the required dependencies:
    ```sh
    npm install
    ```
3. input token at `tokens.txt` file
    ```bash
    nano tokens.txt
    ```
4. Run the script: for first time running this will ask you to input apiKey
    ```sh
    npm run start
    ```

## ![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)

This project is licensed under the [MIT License](LICENSE).