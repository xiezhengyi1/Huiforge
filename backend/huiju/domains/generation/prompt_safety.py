"""Deterministic balanced-mode prompt review for locally hosted image models."""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass


LOCAL_IMAGE_MODEL_IDS = frozenset({
    "qwen_image",
    "zimage_turbo",
    "zimage",
    "flux",
    "flux2",
    "qwen_image_edit",
})

POLICY_VERSION = "balanced-v1"


@dataclass(frozen=True)
class PromptSafetyViolation:
    category: str
    message: str

    def public_error(self) -> dict[str, str]:
        return {
            "error": "prompt_safety_violation",
            "category": self.category,
            "message": self.message,
            "policy": POLICY_VERSION,
        }


_CATEGORY_MESSAGES = {
    "sexual_minors": "提示词涉及未成年人性内容，本地模型拒绝生成。",
    "explicit_sexual": "提示词涉及露骨色情内容，本地模型拒绝生成。",
    "graphic_violence": "提示词涉及重度血腥、虐待或极端暴力内容，本地模型拒绝生成。",
    "criminal_facilitation": "提示词涉及促进违法犯罪的内容，本地模型拒绝生成。",
    "hate_extremism": "提示词涉及仇恨煽动或极端主义宣传，本地模型拒绝生成。",
    "privacy_abuse": "提示词涉及隐私侵害或非自愿私密内容，本地模型拒绝生成。",
}

_MINOR_TERMS = (
    "未成年人", "未成年", "未满18岁", "十八岁以下", "幼女", "幼男", "幼童",
    "儿童", "小学生", "初中生", "高中生", "童颜幼体", "萝莉", "正太",
)
_SEXUAL_CONTEXT_TERMS = (
    "裸体", "全裸", "裸照", "色情", "性爱", "性行为", "性交", "做爱", "口交", "肛交",
    "强奸", "轮奸", "性侵", "性器官", "生殖器", "阴部", "阴茎", "阴道", "射精", "精液",
)
_EXPLICIT_SEXUAL_TERMS = (
    "露骨色情", "成人色情", "色情片", "性交", "做爱", "口交", "肛交", "群交", "轮奸",
    "强奸", "性侵过程", "性器官特写", "生殖器特写", "阴茎特写", "阴道特写", "插入阴道",
    "插入肛门", "射精特写", "精液喷射",
)
_GRAPHIC_VIOLENCE_TERMS = (
    "斩首特写", "砍头特写", "断肢特写", "肢解尸体", "尸体肢解", "开膛破肚", "内脏外露",
    "脑浆飞溅", "爆头鲜血", "剥皮特写", "酷刑折磨", "虐杀过程", "割腕鲜血特写", "自残伤口特写",
)
_CRIMINAL_FACILITATION_TERMS = (
    "伪造身份证模板", "制作假身份证", "伪造护照模板", "制作假护照", "制作假钞模板",
    "钓鱼登录页面", "钓鱼登录页", "诈骗收款码", "盗刷银行卡教程", "毒品制作教程",
    "入室开锁教程", "规避监控盗窃", "勒索信模板", "伪造公章模板",
)
_HATE_EXTREMISM_TERMS = (
    "纳粹招募海报", "纳粹宣传海报", "恐怖组织招募", "恐怖组织宣传海报", "极端组织招募",
    "宣扬种族灭绝", "美化种族屠杀", "美化大屠杀", "白人至上宣传", "种族至上宣传",
)
_PROTECTED_GROUP_TERMS = (
    "黑人", "白人", "亚洲人", "犹太人", "穆斯林", "基督徒", "汉族", "维吾尔族",
    "同性恋", "跨性别者", "残疾人", "女性", "男性", "某个民族", "某种族",
)
_DEHUMANIZING_TERMS = (
    "全部杀光", "全部灭绝", "彻底清除", "低等民族", "不是人类", "都是畜生", "都是寄生虫",
)
_PRIVACY_ABUSE_TERMS = (
    "人肉搜索海报", "曝光他人住址", "泄露他人住址", "公布他人手机号", "公开他人身份证号",
    "身份证正反面高清复刻", "银行卡正反面高清复刻", "偷拍私密照", "非自愿私密照", "报复性色情",
)

_ENGLISH_MINOR = re.compile(
    r"(?<![a-z])(?:underage|minor|child|schoolgirl|schoolboy|loli|shota)(?![a-z])"
)
_ENGLISH_SEXUAL_CONTEXT = re.compile(
    r"(?<![a-z])(?:nude|naked|porn(?:ography|ographic)?|sex(?:ual)?|intercourse|rape|genitals?)(?![a-z])"
)
_ENGLISH_EXPLICIT_SEXUAL = re.compile(
    r"(?<![a-z])(?:porn(?:ography|ographic)?|gangbang|rape|ejaculation|intercourse)(?![a-z])"
    r"|oral[\W_]*sex|anal[\W_]*sex|genital[\W_]*close[\W_]*up|explicit[\W_]*sex"
)
_ENGLISH_GRAPHIC_VIOLENCE = re.compile(
    r"decapitation[\W_]*close[\W_]*up|dismembered[\W_]*corpse|exposed[\W_]*organs|"
    r"graphic[\W_]*gore|torture[\W_]*scene|blood[\W_]*soaked[\W_]*self[\W_]*harm"
)
_ENGLISH_CRIMINAL_FACILITATION = re.compile(
    r"fake[\W_]*(?:id|passport)[\W_]*template|counterfeit[\W_]*money[\W_]*template|"
    r"phishing[\W_]*login[\W_]*page|credit[\W_]*card[\W_]*fraud[\W_]*guide|"
    r"drug[\W_]*manufacturing[\W_]*tutorial"
)
_ENGLISH_HATE_EXTREMISM = re.compile(
    r"nazi[\W_]*recruitment[\W_]*poster|terrorist[\W_]*recruitment[\W_]*poster|"
    r"white[\W_]*supremacist[\W_]*propaganda|glorif(?:y|ying)[\W_]*genocide"
)
_ENGLISH_PRIVACY_ABUSE = re.compile(
    r"doxx(?:ing)?[\W_]*(?:poster|target|address)|leak[\W_]*(?:their|his|her)[\W_]*home[\W_]*address|"
    r"non[\W_]*consensual[\W_]*intimate[\W_]*image|revenge[\W_]*porn"
)


def _normalized_prompt(prompt: str) -> tuple[str, str]:
    normalized = unicodedata.normalize("NFKC", prompt).casefold()
    compact = "".join(character for character in normalized if character.isalnum())
    return normalized, compact


def _contains(compact: str, terms: tuple[str, ...]) -> bool:
    return any(term.casefold() in compact for term in terms)


def _violation(category: str) -> PromptSafetyViolation:
    return PromptSafetyViolation(category=category, message=_CATEGORY_MESSAGES[category])


def review_local_image_prompt(model: str, prompt: str) -> PromptSafetyViolation | None:
    """Return the first balanced-policy violation for a local image request."""
    if model not in LOCAL_IMAGE_MODEL_IDS:
        return None

    normalized, compact = _normalized_prompt(prompt)
    minor_context = _contains(compact, _MINOR_TERMS) or bool(_ENGLISH_MINOR.search(normalized))
    sexual_context = _contains(compact, _SEXUAL_CONTEXT_TERMS) or bool(_ENGLISH_SEXUAL_CONTEXT.search(normalized))
    if minor_context and sexual_context:
        return _violation("sexual_minors")
    if _contains(compact, _EXPLICIT_SEXUAL_TERMS) or _ENGLISH_EXPLICIT_SEXUAL.search(normalized):
        return _violation("explicit_sexual")
    if _contains(compact, _GRAPHIC_VIOLENCE_TERMS) or _ENGLISH_GRAPHIC_VIOLENCE.search(normalized):
        return _violation("graphic_violence")
    if _contains(compact, _CRIMINAL_FACILITATION_TERMS) or _ENGLISH_CRIMINAL_FACILITATION.search(normalized):
        return _violation("criminal_facilitation")
    if _contains(compact, _HATE_EXTREMISM_TERMS) or _ENGLISH_HATE_EXTREMISM.search(normalized):
        return _violation("hate_extremism")
    if _contains(compact, _PROTECTED_GROUP_TERMS) and _contains(compact, _DEHUMANIZING_TERMS):
        return _violation("hate_extremism")
    if _contains(compact, _PRIVACY_ABUSE_TERMS) or _ENGLISH_PRIVACY_ABUSE.search(normalized):
        return _violation("privacy_abuse")
    return None
