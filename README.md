<h1><a href="https://t.me/tg_stories_downloader_bot">📥 Telegram Stories Downloader Bot</a></h1>

<p>The bot allows users to view Telegram stories anonymously by leveraging a bot and userbot</p>

<h2>⚙️ How it works?</h2>

1️⃣ User Interaction: User sends the Telegram username (@username) to the bot

2️⃣ Bot Processing: The bot forwards the username to a userbot

3️⃣ Userbot Involvement: The userbot communicates with a service responsible for uploading stories anonymously

4️⃣ Story Retrieval: After the stories are uploaded, the userbot sends all uploaded stories back to the bot

5️⃣ User Delivery: Finally, the bot delivers the stories to the user for viewing

<h2>🧰 Tools Used</h2>

🤖 <a href="https://gram.js.org/">GramJS</a> 🤖 - This library serves as the backbone of the userbot component

👾 <a href="https://telegraf.js.org/">Telegraf</a> 👾 - utilized for the bot, facilitating the creation Telegram bots

☄️ <a href="https://effector.dev/">Effector</a> ☄️ - used for writing the business logic of the app, ensuring efficient state management and handling of complex workflows

📦 <a href="https://supabase.com/">Supabase</a> 📦 - integrated for analytics data collection

<h2>🛠 Setup</h2>
<p>To run this project locally, follow these steps:</p>

- Install all dependencies
```shell
yarn
```

- Configure Credentials:

Set up your Telegram and userbot credentials in the configuration file

- Start the bot:

Launch the bot in development mode using:
```shell
yarn dev
```

- Enter Userbot Login Code:

Upon starting the bot, you'll receive a login code from Telegram. Enter this code when prompted by the userbot

- Ready to Go:

Once the bot and userbot are up and running, the Telegram Story Viewer is ready to use!

<h2>🚀 Usage</h2>
Just send a message to the bot with the desired Telegram username (@username). Wait for the bot to retrieve and deliver the stories back to you

<h2>📸 Screenshots</h2>

<table>
	<tr>
		<td><img src="https://github.com/chupapee/readme-storage/blob/main/images/bots/tg-stories-downloader-bot.png" alt="telegram stories downloader bot"></td>
	</tr>
</table>
