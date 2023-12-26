<h1 align='center'><a href='https://t.me/insta_twitter_youtube_bot'>📥 Social Media downloader bot</a></h1>
<br/>
<p align='center'>
    <img alt='Typescript usage stat' src='https://img.shields.io/github/languages/top/comeall09/insta-twitter-youtube-bot?style=for-the-badge'/>
    <img alt='NodeJS' src='https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white'/>
    <img alt='Telegram' src='https://img.shields.io/badge/Telegram-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white'/>
    <br/>
    <br/>
    <img alt='Twitter' src='https://img.shields.io/badge/Twitter-%231DA1F2.svg?style=for-the-badge&logo=Twitter&logoColor=white'/>
    <img alt='TikTok' src='https://img.shields.io/badge/TikTok-%23000000.svg?style=for-the-badge&logo=TikTok&logoColor=white'/>
    <img alt='YouTube' src='https://img.shields.io/badge/YouTube-%23FF0000.svg?style=for-the-badge&logo=YouTube&logoColor=white'/>
    <img alt='Intagram' src='https://img.shields.io/badge/Instagram-%23E4405F.svg?style=for-the-badge&logo=Instagram&logoColor=white'/>
</p>

<h2 align='center'>Screenshots</h2>
<table align='center'>
	<tr>
		<td><img alt="Twitter" src="https://github.com/comeall09/readme-storage/blob/main/images/bots/media-bot/tweet.png"></td>
		<td><img alt="YouTube" src="https://github.com/comeall09/readme-storage/blob/main/images/bots/media-bot/you.png"></td>
	</tr>
	<tr>
		<td><img alt="TikTok" src="https://github.com/comeall09/readme-storage/blob/main/images/bots/media-bot/tiktok.png"></td>
		<td><img alt="Instagram" src="https://github.com/comeall09/readme-storage/blob/main/images/bots/media-bot/insta.png"></td>
</tr>
</table>


<br/>

<h3 align='center'>🛠 Capabilities and Tech Stack 🛠</h3>

<table align='center'>
	<thead>
		<tr>
			<th align='left'>Features</th>
			<th align='left'>Available commands</th>
			<th align='left'>Technology stack</th>
		</tr>
	</thead>
	<tbody>
		<tr>
			<td>📹 Video downloading from <a href="https://tiktok.com/">TikTok</a> & <a href="https://www.youtube.com/">YouTube</a></td>
			<td>▶️ `/start` to start using the bot</td>
			<td>⚙️ <a href="https://telegrafjs.org/">Telegraf 4</a></td>
		</tr>
		<tr>
			<td>📸 Downloading photos, videos, reels,<br/>and stories from <a href="https://instagram.com/">Instagram</a> in any quantity</td>
			<td>💬 `/feedback` to send feedback to <a href="https://t.me/chupapee">me</a></td>
			<td>🟩 <a href="https://www.nodejs.org/">NodeJS</a></td>
		</tr>
		<tr>
			<td>📝 Downloading tweets with<br/>all the nested media from <a href="https://twitter.com/">Twitter</a></td>
			<td>🌎 `/en` to change the language to English</td>
			<td>📘 <a href="https://www.typescriptlang.org/">Typescript</a></td>
		</tr>
		<tr>
			<td>🌐 English and Russian localizations</td>
			<td>🌏 `/ru` to change the language to Russian</td>
			<td>🛠️ Web <a href="https://pptr.dev/">scraping</a> <a href="https://cheerio.js.org/">tools</a></td>
		</tr>
	</tbody>
</table>

<br/>

<h2 align='center'>Installation</h2>

Install all dependencies:

```shell
yarn install
```
Don't forget to create `.env` (from `.env.example`).

<br/>
<h2 align='center'>Run</h2>

### Development mode
Just run the following command:
```shell
yarn dev
```

<br/>

### Production mode
There are two options to run the application in production:
- using [Docker](https://www.docker.com/) ([main branch](https://github.com/comeall09/social-media-downloader-bot/tree/main))
- and [Pm2](https://pm2.io/) - the process management tool ([latest branch](https://github.com/comeall09/social-media-downloader-bot/tree/latest))

<br/>

#### Building with Docker

1. Switch to the [main branch](https://github.com/comeall09/social-media-downloader-bot/tree/main):
```shell
git checkout main
```
2. Build the application image:
```shell
docker build -t <your-repo>/social-media-downloader .
```
3. Run the image:
```shell
docker run -d --name bot --restart unless-stopped <your-repo>/social-media-downloader
```

<br/>

#### Building with Pm2

1. Switch to the [latest branch](https://github.com/comeall09/social-media-downloader-bot/tree/latest):
```shell
git checkout latest
```
2. If you are running the process on [Ubuntu v22.04](https://ubuntu.com/) (like me), you will need to install additional dependencies to ensure the bot functions correctly:
```shell
# Install Google Chrome Stable and fonts
# Note: this installs the necessary libs to make the browser work with Puppeteer.
apt-get update && apt-get install gnupg wget -y && \
  wget --quiet --output-document=- https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor > /etc/apt/trusted.gpg.d/google-archive.gpg && \
  sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' && \
  apt-get update && \
  apt-get install google-chrome-stable -y --no-install-recommends && \
  rm -rf /var/lib/apt/lists/*
```
3. Start the bot with the following command:
```shell
yarn process:start
```
