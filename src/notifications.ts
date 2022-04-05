import { createTransport } from 'nodemailer';


export async function sendEmail(article) {
    
    const transporter = createTransport({
        host: process.env.MAIL_HOST,
        port: Number(process.env.MAIL_PORT),
        secure: !!process.env.MAIL_SECURE,
        auth: {
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_PASSWORD
        }
    });
    
    const info = await transporter.sendMail({
        from: `"Noel's Haussucheroboter 🏘" <${process.env.MAIL_USER}>`,
        to: process.env.MAIL_TARGET,
        subject: process.env.MAIL_SUBJECT,
        html: `
<h3 style="color: #23B5D3">${article.title} <b>${article.price}</b> (${article.date})</h3>
<p>Lieber Thoren, liebe Sylvi,<br/><br/>
gerade habe ich ein potentielles Haus für euch gefunden. Die Anzeige heißt "${article.title}" und hat folgende Beschreibung: <br>
<span style="color: #333">
${article.description}
</span><br/><br/>
Falls euch das Haus gefällt, könnt ihr <b><a href="${article.link}">hier</a></b> klicken um Näheres zu erfahren.
<br/><br/>
Liebe Grüße
<br/>
Noel's Haussucheroboter
<br/><br/><br/><br/>
</p>
<small><i>Unique ID: ${article.uniqueKey}<i/></small><br/><br/>
<img src="${article.img}"/>
`
    });

    await transporter.close();

    console.log(`Notified user about the new article.`);
}
