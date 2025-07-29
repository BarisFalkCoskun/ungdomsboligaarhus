import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import AnonymizeUAPlugin from 'puppeteer-extra-plugin-anonymize-ua';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import LoginDatabase from '../db/db.js';

// Use the plugin with puppeteer
puppeteer.use(AnonymizeUAPlugin());
puppeteer.use(StealthPlugin());

const mainPage = 'https://ungdomsboligaarhus.dk/user';
const userPage = 'https://ungdomsboligaarhus.dk/user/edit';

async function goToWebsite(page, url, network = 'networkidle0') {
	await page.setDefaultTimeout(600000);
	try {
		return await page.goto(url, {
			waitUntil: network,
			timeout: 600000,
		});
	} catch {
		return await page.goto(url, {
			waitUntil: network,
			timeout: 600000,
		});
	}
}

async function setupBrowser(head = false, devtools = false) {
	let headlessOption;
	if (head) {
		headlessOption = false;
	} else {
		headlessOption = true;
	}

	let config = {
		args: [
			'--no-sandbox',
			'--disable-setuid-sandbox',
			'--disable-web-security'
		],
		headless: headlessOption,
		devtools: devtools,
	};

	return await puppeteer.launch(config);
}

async function setupPage(browser) {
	const page = await browser.newPage();
	await page.setViewport({
		width: 1920,
		height: 1080,
		deviceScaleFactor: 2,
	});

	return page;
}

async function getRandomInt(max) {
	return Math.floor(Math.random() * max);
}

async function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getCurrentDate(page) {
	let currentDay = await page.evaluate(() =>
		Array.from(
			document.querySelectorAll(
				"#edit-onskedato-day option[selected='selected']"
			)
		).map((d) => d.getAttribute('value'))
	);

	let currentMonth = await page.evaluate(() =>
		Array.from(
			document.querySelectorAll(
				"#edit-onskedato-month option[selected='selected']"
			)
		).map((d) => d.getAttribute('value'))
	);

	let currentYear = await page.evaluate(() =>
		Array.from(
			document.querySelectorAll(
				"#edit-onskedato-year option[selected='selected']"
			)
		).map((d) => d.getAttribute('value'))
	);

	return {
		day: String(currentDay[0]),
		month: String(currentMonth[0]),
		year: String(currentYear[0]),
	};
}

async function postponeMoveInDate(page, url) {
	await goToWebsite(page, url);

	const today = new Date();
	const month = String(today.getMonth() + 1).padStart(2, '0');
	const year = today.getFullYear();

	const newDates = await postponeBySixMonths(month, year);

	let current = await getCurrentDate(page);

	let currentDay = current['day'];
	let currentMonth = current['month'];
	let currentYear = current['year'];

	let changedDay = currentDay !== newDates['day'];
	if (changedDay) {
		await page.select('.date-day #edit-onskedato-day', newDates['day']);
	}

	let changedMonth = currentMonth !== newDates['month'];
	if (changedMonth) {
		await page.select('.date-month #edit-onskedato-month', newDates['month']);
	}

	let changedYear = currentYear !== newDates['year'];
	if (changedYear) {
		await page.select('.date-year #edit-onskedato-year', newDates['year']);
	}

	if (changedDay || changedMonth || changedYear) {
		await Promise.all([page.click('#edit-submit'), page.waitForNetworkIdle()]);
	}

	await goToWebsite(page, mainPage);

	if (changedDay || changedMonth || changedYear) {
		return true;
	} else {
		return false;
	}
}

async function postponeBySixMonths(month, year) {
	const monthsInAYear = 12;
	const sixMonths = 6;
	const day = 1;

	let newMonth = parseInt(month) + sixMonths;
	if (newMonth > monthsInAYear) {
		newMonth = (parseInt(month) + sixMonths) % monthsInAYear;
		year = year + 1;
	}

	return { day: String(day), month: String(newMonth), year: String(year) };
}

async function sendMail(message) {
	const transporter = nodemailer.createTransport({
		host: process.env.EM_HOST,
		port: process.env.EM_PORT,
		auth: {
			user: process.env.EM_USER,
			pass: process.env.EM_PASS,
		},
	});

	transporter.sendMail(message);
}

async function performReapply(browser, user) {
	const usernameLogin = '#content #edit-name';
	const userpassLogin = '#content #edit-pass';
	const submitLogin = '#edit-submit';

	const page = await setupPage(browser);

	const toEmail = user['id'];
	const username = user['login_name'];
	const userpass = user['login_pass'];
	const postpone = parseInt(user['postpone']);
	const userAgent = user['user_agent'];

	await page.setUserAgent(userAgent);
	await goToWebsite(page, mainPage);
	await page.type(usernameLogin, username);
	await page.type(userpassLogin, userpass);

	let renewed = false;
	page.on('response', (response) => {
		if (response.url().includes(mainPage)) {
			renewed = response.url().includes(username);
		}
	});

	await Promise.all([
		page.click(submitLogin),
		page.waitForNavigation({ waitUntil: 'networkidle0' }),
	]);

	if (!renewed) {
		return;
	}

	let hasPostpone = false;
	if (postpone) {
		hasPostpone = await postponeMoveInDate(page, userPage);
	}

	let message = 'Du har nu genansøgt.' + '\n\n';

	let anciennitet = await page.$$eval(
		'.info-row:nth-child(7) .text-right',
		(elements) => elements.map((item) => item.textContent)
	);

	message += 'Anciennitet: ' + anciennitet + '\n';	

	let onskedato = await page.$eval(
		'.info-row:nth-child(4) .text-right',
		(el) => el.textContent
	);

	await LoginDatabase.updatePostponeDate(toEmail, onskedato);
	onskedato = onskedato.trim().replace('\n', '');

	message += 'Ønskedato: ';
	if (hasPostpone) {
		message += 'Ændret til den ';
	}

	message += onskedato + '\n';

	let email = await page.$eval(
		'.info-row:nth-child(2) .text-right',
		(el) => el.textContent
	);

	let subject = 'Genansøgt. Du har nu ' + anciennitet + ' anciennitet';

	await LoginDatabase.updateLastLogin(toEmail);

	const mailMessage = {
		to: email,
		subject: subject,
		text: message,
	};

	await sendMail(mailMessage);
}

(async () => {
	let browser;
	// Load environment variables from .env file
	dotenv.config();

	try {
		await LoginDatabase.initialize();
		const users = await LoginDatabase.getAll();
		for (const user of users) {
			browser = await setupBrowser();
			await performReapply(browser, user);
			await browser.close();
			const sleepTime = await getRandomInt(180000);
			await sleep(sleepTime);
		}
	} catch (error) {
		console.log(error);
		const mailMessage = {
			to: process.env.EM_NOTIFY_MAIL,
			subject: 'Programmet er crashet',
			text: error.message,
		};

		await sendMail(mailMessage);
		await LoginDatabase.close();
		await browser.close();
	}
})();
