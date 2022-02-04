import { config } from 'dotenv';
import { createPool, Pool, PoolConfig } from 'mysql';
import { schedule } from 'node-cron';
import Puppeteer, { launch, LaunchOptions } from 'puppeteer';

import { Article } from './article.model';
import { storeArticle } from './storage';


/** Only use .env files when running in dev mode */
if (!process.env.produtction) config();

// https://www.nestoria.de/haus/mieten/stadecken-elsheim?price_max=1500
// https://www.immonet.de/immobiliensuche/sel.do?pageoffset=1&listsize=26&objecttype=1&locationname=Stadecken-Elsheim&acid=&actype=&city=142884&ajaxIsRadiusActive=true&sortby=16&suchart=2&radius=25&pcatmtypes=2_2&pCatMTypeStoragefield=2_2&parentcat=2&marketingtype=2&fromprice=&toprice=1300&fromarea=&toarea=&fromplotarea=&toplotarea=&fromrooms=&torooms=&objectcat=-1&wbs=-1&fromyear=&toyear=&fulltext=&absenden=Ergebnisse+anzeigen
// Nachrichtenblatt

export const mainPost = 'https://www.nestoria.de/haus/mieten/stadecken-elsheim?bedrooms=3,4&price_max=1000&price_min=600&radio=10';
export const itemSpacer = '\n\n';

async function scrape(pool: Pool) {
    const browser = await Puppeteer.launch(<LaunchOptions>{
        headless: true,
        args: ['--no-sandbox', '--disable-gpu'],
        timeout: 0
    });

    const page = await browser.newPage();
    await page.goto(mainPost);

    /** Items are text array of the html <article> node inner text. */
    const items = await page.evaluate(() => {
        const mapToNotEmptyInnerHtml = (ele: Element) => ele.innerHTML.replace(/\s/g, '');
        const mapToText = (ele: Element) => ele.textContent?.replace(/\r\n|\n|\r/g, '');

        const titles = Array.from(document.querySelectorAll('.listing__title__text')).map(ele => ele.innerHTML.split('\n')[0]);
        const descriptions = Array.from(document.querySelectorAll('.listing__description')).map(ele =>
            ele.textContent?.replace(/\r\n|\n|\r/g, '').replace('                            ', '')
        );
        const prices = Array.from(document.querySelectorAll('.result__details__price'))
            .map(mapToText)
            .map(s => s?.replace('                           ', ','));
        const links = Array.from(document.querySelectorAll('.results__link')).map(ele => ele.getAttribute('data-href'));
        const images = Array.from(document.querySelectorAll('.desktopImg')).map(ele => ele.getAttribute('data-lazy'));
        const articles: any[] = [];

        for (let i = 0; i < titles.length; i++) {
            articles.push({
                title: titles[i],
                description: descriptions[i],
                price: prices[i],
                link: 'https://www.nestoria.de' + links[i],
                image: images[i]
            });
        }

        return articles;
    });

    const articles: Article[] = [];

    items.forEach(item => {
        articles.push(new Article(item.title, new Date().toDateString(), item.description, item.price, item.image, item.link));
    });

    articles.forEach(article => storeArticle(article, pool));

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
