import { config } from 'dotenv';
import { createPool, Pool, PoolConfig } from 'mysql';
import { schedule } from 'node-cron';
import Puppeteer, { launch, LaunchOptions } from 'puppeteer';

import { storePrice } from './storage';


/** Only use .env files when running in dev mode */
if (!process.env.produtction) config();

export const ebay =
    'https://www.ebay-kleinanzeigen.de/s-autos/mazda/mx-5/k0c216+autos.ez_i:1999%2C+autos.km_i:170000%2C182000+autos.marke_s:mazda+autos.power_i:%2C110';
export const itemSpacer = '\n\n';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function scrape(pool: Pool) {
    const browser = await Puppeteer.launch(<LaunchOptions>{
        headless: true,
        args: ['--no-sandbox', '--disable-gpu'],
        timeout: 0
    });

    const page = await browser.newPage();

    await page.goto(ebay);

    await delay(1000);

    await page.click('#gdpr-banner-accept');

    /** Items are text array of the html <article> node inner text. */
    const [aids, price] = await page.evaluate(() => {
        const price = Array.from(document.querySelectorAll('.aditem-main--middle--price')).map(ele =>
            ele?.innerHTML
                .replace(/(\r\n|\n|\r)/gm, '')
                .replace(/<[^>]*>/g, '')
                ?.trim()
                .replace(/\D/g, '')
        );
        const aids: string[] = [];
        document.querySelectorAll('article')?.forEach(a => aids.push(a.dataset['adid'] || ''));
        return [aids, price];
    });

    const prices: { id: string; price: number }[] = [];
    for (let i = 0; i < aids.length; i++) {
        prices.push({ id: aids[i], price: Number(price[i]) });
    }

    let initialValue = prices.map(i => i.price).reduce((previousValue, currentValue) => previousValue + currentValue, 0);
    const median = initialValue / prices.length;

    prices.forEach(priceData => {
        storePrice(priceData, pool);
    });

    console.log('Current median: ' + Math.round(median));

    await browser.close();
}

const pool: Pool = createPool(<PoolConfig>{
    host: process.env.HOST,
    user: process.env.USER,
    password: process.env.PASSWORD,
    database: process.env.DATABASE,
    port: process.env.PORT
});

// Scrape every 15 minutes if production mode is enabled (https://crontab.guru is your best friend)
const interval = process.env.production ? '*/30 * * * *' : '* * * * *';
console.log(`Scraping every ${process.env.production ? '15 minutes' : 'minute'}.`);

if (!process.env.production) {
    scrape(pool);
}

schedule(interval, () => scrape(pool));
