const DEFAULT_TO = "manager.rubens@gmail.com";

const SCRIPT_PROPS = Object.freeze({
  webhookToken: "WEBHOOK_TOKEN",
  defaultTo: "DEFAULT_TO",
});

const PAYLOAD_SUBJECT_PREFIX = "[JOB_DIGEST_PAYLOAD]";
const PROCESSED_LABEL = "CodexDigestProcessed";
const ERROR_LABEL = "CodexDigestError";

function doPost(e) {
  try {
    const payload = JSON.parse((e.postData && e.postData.contents) || "{}");
    validateToken_(payload.token);

    const to = payload.to || getDefaultTo_();
    const subject = payload.subject || buildSubject_();
    const htmlBody = renderDigestHtml_(payload);
    const plainBody = buildPlainBody_(payload);

    GmailApp.sendEmail(to, subject, plainBody, {
      htmlBody: htmlBody,
      name: "Ruben Job Fit Alerts",
    });

    return json_({
      ok: true,
      sentTo: to,
      subject: subject,
      jobs: (payload.jobs || []).length,
      template: payload.template || "job-alerts",
    });
  } catch (error) {
    return json_({
      ok: false,
      error: String(error && error.message ? error.message : error),
    });
  }
}

function setupScriptProperties() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty(SCRIPT_PROPS.webhookToken)) {
    props.setProperty(
      SCRIPT_PROPS.webhookToken,
      Utilities.getUuid() + "-" + Utilities.getUuid()
    );
  }
  props.setProperty(SCRIPT_PROPS.defaultTo, DEFAULT_TO);
  Logger.log("WEBHOOK_TOKEN: " + props.getProperty(SCRIPT_PROPS.webhookToken));
  Logger.log("DEFAULT_TO: " + props.getProperty(SCRIPT_PROPS.defaultTo));
}

function setupPayloadRelayTrigger() {
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === "processPendingDigestPayloads")
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger("processPendingDigestPayloads")
    .timeBased()
    .atHour(8)
    .nearMinute(15)
    .everyDays(1)
    .inTimezone("America/Sao_Paulo")
    .create();

  ScriptApp.newTrigger("processPendingDigestPayloads")
    .timeBased()
    .atHour(20)
    .nearMinute(15)
    .everyDays(1)
    .inTimezone("America/Sao_Paulo")
    .create();
}

function processPendingDigestPayloads() {
  const processedLabel = getOrCreateLabel_(PROCESSED_LABEL);
  const errorLabel = getOrCreateLabel_(ERROR_LABEL);
  const query = [
    "from:" + getDefaultTo_(),
    "to:" + getDefaultTo_(),
    'subject:"' + PAYLOAD_SUBJECT_PREFIX + '"',
    "newer_than:7d",
    "-label:" + PROCESSED_LABEL,
  ].join(" ");

  const threads = GmailApp.search(query, 0, 10);

  threads.forEach((thread) => {
    try {
      const messages = thread.getMessages();
      const message = messages[messages.length - 1];
      const payload = JSON.parse(extractJson_(message.getPlainBody()));

      validateToken_(payload.token);

      const to = payload.to || getDefaultTo_();
      const subject = payload.subject || buildSubject_();
      const htmlBody = renderDigestHtml_(payload);
      const plainBody = buildPlainBody_(payload);

      GmailApp.sendEmail(to, subject, plainBody, {
        htmlBody: htmlBody,
        name: "Ruben Job Fit Alerts",
      });

      thread.addLabel(processedLabel);
      thread.moveToArchive();
    } catch (error) {
      thread.addLabel(errorLabel);
      GmailApp.sendEmail(
        getDefaultTo_(),
        "Erro ao processar payload do digest de vagas",
        String(error && error.stack ? error.stack : error)
      );
    }
  });
}

function testSendJobAlertsDigest() {
  const payload = sampleJobAlertsPayload_();
  validateToken_(payload.token);
  GmailApp.sendEmail(payload.to, payload.subject, buildPlainBody_(payload), {
    htmlBody: renderDigestHtml_(payload),
    name: "Ruben Job Fit Alerts",
  });
}

function testSendSiemensEnergyDigest() {
  const payload = sampleSiemensEnergyPayload_();
  validateToken_(payload.token);
  GmailApp.sendEmail(payload.to, payload.subject, buildPlainBody_(payload), {
    htmlBody: renderDigestHtml_(payload),
    name: "Ruben Job Fit Alerts",
  });
}

function renderDigestHtml_(payload) {
  if (payload.template === "siemens-energy") {
    return buildSiemensEnergyDigestHtml_(payload);
  }
  return buildJobDigestHtml_(payload);
}

function buildJobDigestHtml_(payload) {
  const stats = payload.stats || {};
  const jobs = payload.jobs || [];
  const otherJobs = payload.otherJobs || [];
  const ignored = payload.ignored || [];
  const signals = payload.signals || [];
  const headline =
    payload.headline ||
    "Ruben, encontrei vagas com bom alinhamento ao seu perfil.";
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");

  return `
<div style="margin:0;padding:0;background:#f3f2ef;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <div style="max-width:720px;margin:0 auto;padding:24px 12px;">
    <div style="background:#ffffff;border:1px solid #d9dde3;border-radius:10px;overflow:hidden;">
      <div style="background:#0a66c2;padding:24px 28px;color:#ffffff;">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;opacity:.9;">
          Job Fit Digest · ${escapeHtml_(today)}
        </div>
        <h1 style="margin:8px 0 8px;font-size:26px;line-height:1.25;font-weight:700;">
          Vagas recomendadas para você
        </h1>
        <p style="margin:0;font-size:15px;line-height:1.55;">
          ${escapeHtml_(headline)}
        </p>
      </div>

      <div style="padding:18px 28px;background:#ffffff;border-bottom:1px solid #e5e7eb;">
        ${pill_(`${stats.emailsScanned || 0} e-mails analisados`, "#e8f3ff", "#0a66c2")}
        ${pill_(`${stats.jobsExtracted || 0} vagas extraídas`, "#edf7ed", "#1f7a3f")}
        ${pill_(`${stats.jobsSelected || jobs.length} selecionadas`, "#fff7e6", "#8a5a00")}
        <div style="margin-top:10px;font-size:13px;color:#6b7280;line-height:1.5;">
          <strong>Principais sinais:</strong> ${escapeHtml_(signals.join(" · ") || "liderança técnica · gestão · delivery · IA")}
        </div>
      </div>

      <div style="padding:22px 20px 8px;background:#f8fafc;">
        <h2 style="margin:0 8px 14px;font-size:17px;line-height:1.3;color:#111827;">
          Melhores matches
        </h2>
        ${jobs.map((job, index) => jobCard_(job, index + 1)).join("")}
      </div>

      ${otherJobs.length ? `
      <div style="padding:20px 28px;background:#ffffff;border-top:1px solid #e5e7eb;">
        <h2 style="margin:0 0 12px;font-size:17px;color:#111827;">Outras boas opções</h2>
        ${otherJobs.map(otherJob_).join("")}
      </div>` : ""}

      <div style="padding:18px 28px;background:#ffffff;border-top:1px solid #e5e7eb;">
        <h2 style="margin:0 0 10px;font-size:16px;color:#111827;">Ignorados nesta varredura</h2>
        <ul style="margin:0;padding-left:18px;color:#4b5563;font-size:13px;line-height:1.6;">
          ${ignored.map((item) => `<li>${escapeHtml_(item)}</li>`).join("")}
        </ul>
      </div>

      <div style="padding:18px 28px;background:#f8fafc;color:#6b7280;font-size:12px;line-height:1.55;border-top:1px solid #e5e7eb;">
        <strong>Observação:</strong> ${escapeHtml_(payload.note || "As avaliações são provisórias quando o alerta contém descrição parcial.")}
      </div>
    </div>
  </div>
</div>`;
}

function buildSiemensEnergyDigestHtml_(payload) {
  const stats = payload.stats || {};
  const jobs = payload.jobs || [];
  const otherJobs = payload.otherJobs || [];
  const ignored = payload.ignored || [];
  const signals = payload.signals || [];
  const logoUrl =
    payload.brandLogoUrl ||
    "https://jobs.siemens-energy.com/portal/140/images/logo--hiring-organization.webp";
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");

  return `
<div style="margin:0;padding:0;background:#eef3f1;font-family:Arial,Helvetica,sans-serif;color:#13232b;">
  <div style="max-width:740px;margin:0 auto;padding:24px 12px;">
    <div style="background:#ffffff;border:1px solid #d8e1de;border-radius:12px;overflow:hidden;">
      <div style="background:#102a33;padding:24px 28px;color:#ffffff;border-bottom:5px solid #00e6b8;">
        <img src="${escapeAttr_(logoUrl)}" alt="Siemens Energy" style="display:block;max-width:190px;height:auto;margin:0 0 22px;">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#00e6b8;">
          Siemens Energy Jobs · ${escapeHtml_(today)}
        </div>
        <h1 style="margin:8px 0 8px;font-size:26px;line-height:1.25;font-weight:700;">
          Vagas em São Paulo com análise de fit
        </h1>
        <p style="margin:0;font-size:15px;line-height:1.55;color:#dce7e4;">
          ${escapeHtml_(payload.headline || "Ruben, encontrei vagas abertas da Siemens Energy em São Paulo.")}
        </p>
      </div>

      <div style="padding:18px 28px;background:#ffffff;border-bottom:1px solid #e1e8e5;">
        ${siemensPill_(`${stats.jobsExtracted || 0} vagas encontradas`, "#dff8f1", "#006b5a")}
        ${siemensPill_(`${stats.jobsSelected || jobs.length} avaliadas`, "#eaf1ff", "#2154a3")}
        ${siemensPill_("Fonte oficial Siemens Energy", "#f2f5f4", "#52656d")}
        <div style="margin-top:10px;font-size:13px;color:#5d6f76;line-height:1.5;">
          <strong>Sinais avaliados:</strong> ${escapeHtml_(signals.join(" · ") || "liderança · delivery · tecnologia · transformação")}
        </div>
      </div>

      <div style="padding:22px 20px 8px;background:#f7faf9;">
        <h2 style="margin:0 8px 14px;font-size:17px;color:#102a33;">Melhores matches</h2>
        ${jobs.map((job, index) => siemensJobCard_(job, index + 1)).join("")}
      </div>

      ${otherJobs.length ? `
      <div style="padding:20px 28px;background:#ffffff;border-top:1px solid #e1e8e5;">
        <h2 style="margin:0 0 12px;font-size:17px;color:#102a33;">Demais vagas encontradas</h2>
        ${otherJobs.map(siemensOtherJob_).join("")}
      </div>` : ""}

      <div style="padding:18px 28px;background:#ffffff;border-top:1px solid #e1e8e5;">
        <h2 style="margin:0 0 10px;font-size:16px;color:#102a33;">Ignorados ou limitações</h2>
        <ul style="margin:0;padding-left:18px;color:#52656d;font-size:13px;line-height:1.6;">
          ${ignored.map((item) => `<li>${escapeHtml_(item)}</li>`).join("")}
        </ul>
      </div>

      <div style="padding:18px 28px;background:#f7faf9;color:#66777d;font-size:12px;line-height:1.55;border-top:1px solid #e1e8e5;">
        <strong>Observação:</strong> ${escapeHtml_(payload.note || "Avaliação baseada na página oficial de carreiras da Siemens Energy.")}
      </div>
    </div>
  </div>
</div>`;
}

function jobCard_(job, index) {
  const accent = Number(job.score || 0) >= 85 ? "#176b36" : "#8a5a00";
  const bg = Number(job.score || 0) >= 85 ? "#dff6e7" : "#fff4d6";
  const providerColor = String(job.source || "").toLowerCase().includes("glassdoor")
    ? "#0caa41"
    : "#0a66c2";

  return `
  <div style="background:#ffffff;border:1px solid #d9dde3;border-radius:10px;padding:18px;margin:0 0 14px;">
    <div style="font-size:12px;font-weight:700;color:${providerColor};text-transform:uppercase;letter-spacing:.3px;margin-bottom:6px;">
      ${escapeHtml_(job.source || "Alerta de vaga")}
    </div>
    <h3 style="margin:0 0 6px;font-size:20px;line-height:1.3;color:#111827;">
      ${index}. ${escapeHtml_(job.title || "Vaga sem título")}
    </h3>
    <p style="margin:0 0 12px;font-size:14px;color:#4b5563;">
      ${escapeHtml_(job.company || "Empresa não informada")} · ${escapeHtml_(job.location || "Local não informado")} · ${escapeHtml_(job.model || "Modelo não informado")}
    </p>
    <div style="margin:0 0 14px;">
      ${pill_(`${job.score || "?"}/100 · ${job.decision || "Fit a avaliar"}`, bg, accent)}
      ${pill_(`Confiança ${job.confidence || "média"}`, "#eef2f7", "#475569")}
    </div>
    <p style="margin:0 0 8px;font-size:13px;color:#6b7280;font-weight:700;">Por que combina</p>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.55;color:#374151;">${escapeHtml_(job.why || "A vaga tem sinais compatíveis com o perfil-alvo.")}</p>
    <p style="margin:0 0 8px;font-size:13px;color:#6b7280;font-weight:700;">Atenção</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#4b5563;">${escapeHtml_(job.risk || "Nenhum risco relevante identificado no alerta.")}</p>
    <a href="${escapeAttr_(job.url || "#")}" style="display:inline-block;background:${providerColor};color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:10px 16px;border-radius:6px;">
      Ver vaga
    </a>
  </div>`;
}

function siemensJobCard_(job, index) {
  const score = Number(job.score || 0);
  const fitBg = score >= 85 ? "#dff8f1" : score >= 70 ? "#fff4d6" : "#f1f3f4";
  const fitColor = score >= 85 ? "#006b5a" : score >= 70 ? "#8a5a00" : "#52656d";

  return `
  <div style="background:#ffffff;border:1px solid #d8e1de;border-left:5px solid #00e6b8;border-radius:10px;padding:18px;margin:0 0 14px;">
    <div style="font-size:12px;font-weight:700;color:#00856f;text-transform:uppercase;letter-spacing:.35px;margin-bottom:6px;">
      ${escapeHtml_(job.source || "Siemens Energy Careers")}
    </div>
    <h3 style="margin:0 0 6px;font-size:20px;line-height:1.3;color:#102a33;">
      ${index}. ${escapeHtml_(job.title || "Vaga sem título")}
    </h3>
    <p style="margin:0 0 12px;font-size:14px;color:#52656d;">
      ${escapeHtml_(job.company || "Siemens Energy")} · ${escapeHtml_(job.location || "Local não informado")} · ${escapeHtml_(job.model || "Modelo não informado")}
    </p>
    <div style="margin:0 0 14px;">
      ${siemensPill_(`${job.score || "?"}/100 · ${job.decision || "Fit a avaliar"}`, fitBg, fitColor)}
      ${siemensPill_(`Confiança ${job.confidence || "média"}`, "#eaf1ff", "#2154a3")}
    </div>
    <p style="margin:0 0 8px;font-size:13px;color:#66777d;font-weight:700;">Por que combina</p>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.55;color:#263940;">${escapeHtml_(job.why || "")}</p>
    <p style="margin:0 0 8px;font-size:13px;color:#66777d;font-weight:700;">Atenção</p>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#52656d;">${escapeHtml_(job.risk || "")}</p>
    <a href="${escapeAttr_(job.url || "#")}" style="display:inline-block;background:#00a88f;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:10px 16px;border-radius:6px;">
      Ver vaga na Siemens Energy
    </a>
  </div>`;
}

function otherJob_(job) {
  return `
  <div style="border-top:1px solid #edf0f2;padding:12px 0;">
    <div style="font-size:14px;line-height:1.45;color:#111827;font-weight:700;">
      ${escapeHtml_(job.title || "Vaga")} · ${escapeHtml_(job.company || "Empresa")}
    </div>
    <div style="font-size:13px;line-height:1.5;color:#4b5563;margin-top:3px;">
      ${escapeHtml_(String(job.score || "?"))}/100 · ${escapeHtml_(job.note || "")}
    </div>
    ${job.url ? `<a href="${escapeAttr_(job.url)}" style="display:inline-block;margin-top:6px;color:#0a66c2;font-size:13px;font-weight:700;text-decoration:none;">Ver vaga</a>` : ""}
  </div>`;
}

function siemensOtherJob_(job) {
  return `
  <div style="border-top:1px solid #edf2f0;padding:12px 0;">
    <div style="font-size:14px;line-height:1.45;color:#102a33;font-weight:700;">
      ${escapeHtml_(job.title || "Vaga")} · ${escapeHtml_(job.company || "Siemens Energy")}
    </div>
    <div style="font-size:13px;line-height:1.5;color:#52656d;margin-top:3px;">
      ${escapeHtml_(String(job.score || "?"))}/100 · ${escapeHtml_(job.note || "")}
    </div>
    ${job.url ? `<a href="${escapeAttr_(job.url)}" style="display:inline-block;margin-top:6px;color:#00856f;font-size:13px;font-weight:700;text-decoration:none;">Ver vaga</a>` : ""}
  </div>`;
}

function pill_(text, bg, color) {
  return `<span style="display:inline-block;margin:0 8px 8px 0;padding:6px 10px;border-radius:999px;background:${bg};color:${color};font-size:13px;font-weight:700;">${escapeHtml_(text)}</span>`;
}

function siemensPill_(text, bg, color) {
  return `<span style="display:inline-block;margin:0 8px 8px 0;padding:6px 10px;border-radius:999px;background:${bg};color:${color};font-size:13px;font-weight:700;">${escapeHtml_(text)}</span>`;
}

function buildPlainBody_(payload) {
  const jobs = payload.jobs || [];
  return [
    payload.template === "siemens-energy"
      ? "VAGAS SIEMENS ENERGY EM SAO PAULO"
      : "VAGAS RECOMENDADAS PARA VOCE",
    "",
    payload.headline || "Encontrei vagas com bom alinhamento ao seu perfil.",
    "",
    jobs
      .map((job, index) => {
        return `${index + 1}. ${job.title} - ${job.company}
Fit: ${job.score}/100 - ${job.decision}
Por que combina: ${job.why}
Atenção: ${job.risk}
Ver vaga: ${job.url}`;
      })
      .join("\n\n"),
  ].join("\n");
}

function buildSubject_() {
  const date = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  return "Vagas recomendadas para Ruben - " + date;
}

function extractJson_(body) {
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new Error("JSON não encontrado no corpo do e-mail payload.");
  }
  return body.slice(start, end + 1);
}

function validateToken_(token) {
  const expected = PropertiesService.getScriptProperties().getProperty(
    SCRIPT_PROPS.webhookToken
  );
  if (!expected) {
    throw new Error("WEBHOOK_TOKEN não configurado. Rode setupScriptProperties() primeiro.");
  }
  if (!token || token !== expected) {
    throw new Error("Token inválido.");
  }
}

function getDefaultTo_() {
  return (
    PropertiesService.getScriptProperties().getProperty(SCRIPT_PROPS.defaultTo) ||
    DEFAULT_TO
  );
}

function getOrCreateLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function json_(object) {
  return ContentService.createTextOutput(JSON.stringify(object)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function escapeHtml_(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr_(value) {
  return escapeHtml_(value);
}

function sampleJobAlertsPayload_() {
  const token = PropertiesService.getScriptProperties().getProperty(
    SCRIPT_PROPS.webhookToken
  );
  return {
    token: token,
    template: "job-alerts",
    to: getDefaultTo_(),
    subject: "TESTE - Vagas recomendadas para Ruben",
    headline: "Ruben, encontrei 3 vagas com bom alinhamento ao seu perfil.",
    stats: { emailsScanned: 10, jobsExtracted: 32, jobsSelected: 3 },
    signals: ["Tech Manager", "Liderança de squads", "IA", "Delivery ágil"],
    jobs: [
      {
        title: "Tech Manager",
        company: "PicPay",
        location: "São Paulo e Região",
        model: "Remoto",
        source: "LinkedIn",
        score: 90,
        decision: "Forte fit",
        confidence: "Média",
        why: "Match direto com liderança de times ágeis, métricas de entrega e cultura técnica.",
        risk: "Fonte analisada: alerta de e-mail apenas. Confirmar escopo de gestão.",
        url: "https://www.linkedin.com/jobs/",
      },
    ],
    otherJobs: [],
    ignored: ["Alertas sociais e notificações sem vagas"],
    note: "Payload de teste local.",
  };
}

function sampleSiemensEnergyPayload_() {
  const token = PropertiesService.getScriptProperties().getProperty(
    SCRIPT_PROPS.webhookToken
  );
  return {
    token: token,
    template: "siemens-energy",
    brandLogoUrl:
      "https://jobs.siemens-energy.com/portal/140/images/logo--hiring-organization.webp",
    to: getDefaultTo_(),
    subject: "TESTE - Vagas Siemens Energy em São Paulo",
    headline: "Ruben, encontrei vagas abertas da Siemens Energy em São Paulo/Jundiaí.",
    stats: { emailsScanned: 0, jobsExtracted: 35, jobsSelected: 34 },
    signals: ["Siemens Energy", "São Paulo", "Liderança", "Delivery"],
    jobs: [
      {
        title: "IT Business Partner (Analista de Tecnologia SR) - Jundiaí (SP)",
        company: "Siemens Energy",
        location: "Jundiaí, São Paulo, Brasil",
        model: "Híbrido",
        source: "Siemens Energy Careers",
        score: 88,
        decision: "Forte fit",
        confidence: "Alta",
        why: "A vaga pede ponte entre negócio e TI, consultoria digital e gestão ponta a ponta de projetos.",
        risk: "Fonte analisada: descrição completa da página pública. Confirmar inglês fluente e presença híbrida.",
        url: "https://jobs.siemens-energy.com/en_US/jobs/",
      },
    ],
    otherJobs: [],
    ignored: ["Banco de talentos excluído"],
    note: "Payload de teste local.",
  };
}
