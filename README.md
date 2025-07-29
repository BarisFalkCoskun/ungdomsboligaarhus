# UngdomsboligAarhus Automation Script

An automated script for accumulating seniority on [ungdomsboligaarhus.dk](https://ungdomsboligaarhus.dk/).

## Installation

### 1. Server Setup
Set up a server environment. Recommended options:
- Raspberry Pi
- Cheap VPS (e.g., [Uberspace](https://uberspace.de/))

### 2. Clone Repository
```bash
git clone https://github.com/BarisFalkCoskun/ungdomsboligaarhus.git
cd ungdomsboligaarhus
```

### 3. Install Dependencies
```bash
npm install
```

## Configuration

### 1. Email Setup
Create an app password for Gmail:
1. Visit [Google App Passwords](https://myaccount.google.com/apppasswords)
2. Generate a new app password for this application

### 2. Environment Configuration
Create a `.env` file with your email configuration:

```bash
nano .env
```

Add the following content:
```env
EM_HOST=smtp.gmail.com
EM_PORT=465
EM_USER=your_notification_account@gmail.com
EM_PASS="your app password here"
EM_NOTIFY_MAIL=your_primary_email@gmail.com
```

Save and exit (`Ctrl + O`, `Enter`, `Ctrl + X`)

### 3. Database Setup

#### Download and Configure Database
1. Use SFTP (e.g., CyberDuck) to access your server
2. Download the `logins.db` file from the `db` folder
3. Open it with [DB Browser for SQLite](https://sqlitebrowser.org/)

#### Add Your Login Credentials
1. In DB Browser, click **Browse Data**
2. Click **Insert a new record**
3. Fill in the following fields:
   - `login_name`: Your ungdomsboligaarhus.dk username
   - `login_pass`: Your ungdomsboligaarhus.dk password
   - `postpone`: Set to `1` if you want automatic postponing, `0` otherwise
   - `user_agent`: Visit [whatmyuseragent.com](https://whatmyuseragent.com/) and copy your user agent string
4. Click **Apply** after each field
5. Click **Write Changes**
6. Close DB Browser

#### Upload Database
1. Transfer the modified `logins.db` back to your server's `db` folder
2. Set proper permissions:
```bash
chmod 700 db/logins.db
```

## Testing and Deployment

### Test Run
Verify everything works correctly:
```bash
npm start
```

### Automate with Cron
Set up automatic execution:

```bash
crontab -e
```

Add the following line (runs every Sunday at 00:08):
```cron
08 00 * * 0 cd /home/$USER/ungdomsboligaarhus/ && /usr/bin/npm start
```

Save and exit (`Ctrl + O`, `Ctrl + X`)
