"use strict";
import { locale, localeUrl, t } from "./core/locale.js?v=20261125-ui-polish-v3";
const $=(selector)=>document.querySelector(selector);
const setText=(selector,value)=>{const node=$(selector);if(node)node.textContent=value;};
const authPanel=$("#auth-panel");
const accountShell=$("#account-shell");
const authMessage=$("#auth-message");
let historyItems=[];
let selectedHistoryId="";
let smsReady=false;
let smsCountdownTimer=0;

async function request(path,options={}){const response=await fetch(path,{credentials:"same-origin",...options});let body={};try{body=await response.json();}catch{/* Empty response. */}if(!response.ok){const error=new Error(body.detail||body.error||"request_failed");error.status=response.status;throw error;}return body;}
function dateText(seconds){if(!seconds)return "";return new Intl.DateTimeFormat(locale,{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(seconds*1000));}
function showAuthMessage(message){authMessage.textContent=message;}
function setBound(bound){authPanel.hidden=bound;accountShell.hidden=!bound;document.body.classList.toggle("auth-view",!bound);}

function setSmsAvailability(message,state=""){
  const node=$("#sms-availability");
  if(!node)return;
  node.textContent=message;
  node.classList.toggle("is-ready",state==="ready");
  node.classList.toggle("is-error",state==="error");
}

async function loadSmsStatus(){
  const sendButton=$("#send-sms-code");
  const registerButton=$("#register-submit");
  try{
    const status=await request("/api/v1/users/sms/status");
    smsReady=Boolean(status.configured);
    sendButton.disabled=!smsReady;
    registerButton.disabled=!smsReady;
    setSmsAvailability(
      smsReady?"手机号将通过火山引擎短信验证，验证码 5 分钟有效。":"短信注册尚未启用；管理员需补齐短信服务配置。",
      smsReady?"ready":"error",
    );
  }catch{
    smsReady=false;
    sendButton.disabled=true;
    registerButton.disabled=true;
    setSmsAvailability("暂时无法检查短信服务，请稍后重试。","error");
  }
}

function startSmsCountdown(seconds){
  const button=$("#send-sms-code");
  window.clearInterval(smsCountdownTimer);
  let remaining=seconds;
  button.disabled=true;
  button.textContent=`${remaining} 秒后重试`;
  smsCountdownTimer=window.setInterval(()=>{
    remaining-=1;
    if(remaining<=0){window.clearInterval(smsCountdownTimer);button.disabled=!smsReady;button.textContent="获取验证码";return;}
    button.textContent=`${remaining} 秒后重试`;
  },1000);
}

let authTab = "login";
let authMethod = locale === "zh-CN" ? "phone" : "email";
let emailReady = false;
let emailRetryTimer;
const authTabs = document.querySelectorAll("[data-auth-tab]");
const authMethods = document.querySelectorAll("[data-auth-method]");

function renderAuthForms() {
  for (const button of authTabs) {
    const selected = button.dataset.authTab === authTab;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  }
  for (const button of authMethods) {
    const selected = button.dataset.authMethod === authMethod;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", String(selected));
  }
  for (const method of ["phone", "email"]) {
    for (const tab of ["login", "register"]) {
      const form = $(`#${method === "email" ? "email-" : ""}${tab}-form`);
      form.hidden = method !== authMethod || tab !== authTab;
    }
  }
  showAuthMessage("");
}

authTabs.forEach((button) => button.addEventListener("click", () => { authTab=button.dataset.authTab; renderAuthForms(); }));
authMethods.forEach((button) => button.addEventListener("click", () => { authMethod=button.dataset.authMethod; renderAuthForms(); }));
renderAuthForms();

async function loadEmailStatus() {
  try {
    emailReady = Boolean((await request("/api/v1/users/email/status")).configured);
  } catch {
    emailReady = false;
  }
  $("#send-email-code").disabled = !emailReady;
  $("#email-register-submit").disabled = !emailReady;
  setText("#email-availability", emailReady ? "" : t("暂时无法通过邮箱注册。", "Email registration is currently unavailable."));
}

function postEmail(path, payload) {
  return request(`/api/v1/users/email/${path}`, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload)});
}

$("#send-email-code").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const address = $("#register-email");
  if (!emailReady || !address.reportValidity()) return;
  button.disabled = true;
  try {
    const response = await postEmail("send", {email:address.value.trim()});
    const delay = (Number(response.cooldown) || 60) * 1000;
    showAuthMessage(t("验证码已发送，5 分钟内有效。", "Check your email for a code. It expires in 5 minutes."));
    $("#register-email-code").focus();
    clearTimeout(emailRetryTimer);
    emailRetryTimer = setTimeout(() => { button.disabled = !emailReady; }, delay);
  } catch (error) {
    showAuthMessage(error.status === 429
      ? t("发送过于频繁，请稍后再试。", "Please wait a minute before requesting another code.")
      : t("无法发送邮件验证码，请稍后重试。", "Could not send the verification email. Try again shortly."));
    button.disabled = !emailReady;
  }
});

for (const action of ["login", "register"]) {
  $(`#email-${action}-form`).addEventListener("submit", async (event) => {
    event.preventDefault();
    if (action === "register" && !emailReady) return;
    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');
    if (button.disabled) return;
    button.disabled = true;
    try {
      const body = await postEmail(action, Object.fromEntries(new FormData(form)));
      form.reset();
      setBound(true);
      renderProfile(body.profile);
      await loadAccount();
    } catch (error) {
      const message = error.status === 401 ? t("邮箱或密码不正确。", "The email or password is incorrect.")
        : error.status === 422 && action === "register" ? t("验证码不正确或已经过期。", "The code is invalid or has expired.")
        : error.status === 409 ? t("这个邮箱已经注册，请登录。", "An account already uses this email. Sign in instead.")
        : error.status === 429 ? t("操作过于频繁，请稍后再试。", "Too many attempts. Try again shortly.")
        : t("账户操作失败，请稍后重试。", "Could not complete the request. Try again shortly.");
      showAuthMessage(message);
    } finally {
      button.disabled = action === "register" && !emailReady;
    }
  });
}

function renderProfile(profile){setText("#profile-display-name",profile.display_name||t("绘域用户"));setText("#profile-phone",profile.email_masked||profile.phone_masked||"");setText("#profile-bio-preview",profile.bio||t("还没有个人简介。"));$("#display-name-input").value=profile.display_name||"";$("#bio-input").value=profile.bio||"";const image=$("#profile-avatar");const placeholder=$("#avatar-placeholder");if(profile.avatar_url){image.src=profile.avatar_url;image.hidden=false;placeholder.hidden=true;}else{image.hidden=true;placeholder.hidden=false;placeholder.textContent=(profile.display_name||"H").slice(0,1);}}

function renderCredits(wallet){setText("#nav-credit-total",wallet.total??0);setText("#credit-daily",wallet.daily??0);setText("#credit-monthly",wallet.monthly??0);setText("#credit-topup",wallet.topup??0);const member=wallet.membership_tier&&wallet.membership_tier!=="free";setText("#profile-membership",member?"会员用户":"免费用户");const ledger=$("#credit-ledger");const rows=Array.isArray(wallet.ledger)?wallet.ledger:[];ledger.replaceChildren(...rows.map((entry)=>{const row=document.createElement("div");row.className="ledger-row";const label=document.createElement("span");label.textContent=entry.label||"额度变动";const time=document.createElement("time");time.textContent=dateText(entry.created_at);const amount=document.createElement("b");amount.textContent=`${Number(entry.amount)>0?"+":""}${entry.amount}`;amount.classList.toggle("negative",Number(entry.amount)<0);row.append(label,time,amount);return row;}));$("#ledger-empty").hidden=rows.length>0;}

function renderHistory(items){historyItems=items;const grid=$("#account-history-grid");grid.replaceChildren(...items.map((item,index)=>{const button=document.createElement("button");button.type="button";button.className="account-history-card";button.dataset.index=String(index);const image=document.createElement("img");image.src=item.url;image.alt="云端生成作品";image.loading="lazy";const caption=document.createElement("span");caption.textContent=`${dateText(item.created_at)} · ${item.kind||"生成"}`;button.append(image,caption);return button;}));$("#account-history-empty").hidden=items.length>0;}

async function loadAccount(){try{const me=await request("/api/v1/users/me");setBound(Boolean(me.bound&&me.profile));const wallet=await request("/api/v1/credits");renderCredits(wallet);if(me.bound&&me.profile){renderProfile(me.profile);const history=await request("/api/v1/users/history");renderHistory(Array.isArray(history.items)?history.items:[]);}}catch{showAuthMessage("暂时无法连接账户服务，请稍后重试。");}}

$("#login-form").addEventListener("submit",async(event)=>{event.preventDefault();showAuthMessage("正在登录…");const data=Object.fromEntries(new FormData(event.currentTarget));try{const body=await request("/api/v1/users/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});setBound(true);renderProfile(body.profile);await loadAccount();}catch(error){showAuthMessage(error.status===401?"手机号或密码不正确。":"登录失败，请稍后重试。");}});
$("#send-sms-code").addEventListener("click",async()=>{const phone=$("#register-phone").value.trim();if(!/^1[3-9][0-9]{9}$/.test(phone)){showAuthMessage("请先填写正确的 11 位手机号。");return;}showAuthMessage("正在发送验证码…");try{const body=await request("/api/v1/users/sms/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phone})});startSmsCountdown(Number(body.cooldown)||60);showAuthMessage("验证码已发送，5 分钟内有效。");$("#register-sms-code").focus();}catch(error){if(error.status===429)showAuthMessage("发送过于频繁，请稍后再试。");else if(error.status===503)showAuthMessage("短信服务尚未完成配置。");else showAuthMessage("验证码发送失败，请稍后重试。");}});
$("#register-form").addEventListener("submit",async(event)=>{event.preventDefault();if(!smsReady){showAuthMessage("短信服务尚未完成配置，暂时不能注册。");return;}showAuthMessage("正在验证并创建账号…");const data=Object.fromEntries(new FormData(event.currentTarget));try{const body=await request("/api/v1/users/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});setBound(true);renderProfile(body.profile);await loadAccount();}catch(error){if(error.status===409)showAuthMessage("这个手机号已经注册，请直接登录。");else if(error.status===422)showAuthMessage("验证码不正确或已经过期。");else if(error.status===503)showAuthMessage("短信服务尚未完成配置。");else showAuthMessage("注册失败，请检查手机号、验证码和密码。");}});
$("#profile-form").addEventListener("submit",async(event)=>{event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget));setText("#profile-message","正在保存…");try{const body=await request("/api/v1/users/me",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});renderProfile(body.profile);setText("#profile-message","已保存");}catch{setText("#profile-message","保存失败，请稍后重试");}});
$("#avatar-input").addEventListener("change",async(event)=>{const file=event.target.files?.[0];if(!file)return;if(file.size>2*1024*1024){setText("#profile-message", t("头像不能超过 2MB。"));return;}const data=new FormData();data.append("avatar",file,file.name);try{const body=await request("/api/v1/users/avatar",{method:"POST",body:data});renderProfile(body.profile);}catch{setText("#profile-message", t("头像上传失败，请使用 PNG、JPG 或 WebP 图片。"));}event.target.value="";});
$("#logout-button").addEventListener("click",async()=>{await request("/api/v1/users/logout",{method:"POST"});historyItems=[];renderHistory([]);setBound(false);authTab="login";renderAuthForms();showAuthMessage("已退出登录。");});
$("#account-history-grid").addEventListener("click",(event)=>{const card=event.target.closest(".account-history-card");if(!card)return;const item=historyItems[Number(card.dataset.index)];if(!item)return;selectedHistoryId=String(item.id||"");$("#profile-history-image").src=item.url;setText("#profile-history-kind",`${dateText(item.created_at)} · ${item.kind||"生成"}`);setText("#profile-history-prompt",item.prompt||"这条记录没有保存提示词。");$("#profile-history-use").href=localeUrl(`studio.html?prompt=${encodeURIComponent(item.prompt||"")}`);const remove=$("#profile-history-delete");remove.textContent="删除记录";remove.classList.remove("is-confirming");remove.disabled=false;$("#profile-history-dialog").showModal();});
$("#profile-history-delete").addEventListener("click",async(event)=>{const button=event.currentTarget;if(!selectedHistoryId)return;if(!button.classList.contains("is-confirming")){button.classList.add("is-confirming");button.textContent="再次点击删除";window.setTimeout(()=>{if(button.classList.contains("is-confirming")){button.classList.remove("is-confirming");button.textContent="删除记录";}},3200);return;}button.disabled=true;button.textContent="删除中…";try{await request(`/api/v1/users/history/${encodeURIComponent(selectedHistoryId)}`,{method:"DELETE"});historyItems=historyItems.filter((item)=>String(item.id)!==selectedHistoryId);renderHistory(historyItems);selectedHistoryId="";$("#profile-history-dialog").close();}catch{button.disabled=false;button.classList.remove("is-confirming");button.textContent="删除失败，请重试";}});
$("#profile-history-close").addEventListener("click",()=>$("#profile-history-dialog").close());
$("#profile-history-dialog").addEventListener("click",(event)=>{if(event.target===$("#profile-history-dialog"))event.currentTarget.close();});
loadSmsStatus();
loadEmailStatus();
loadAccount();
