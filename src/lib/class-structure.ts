import type { ClassOffering } from "@/lib/types";

export function combineClassArm(baseClassName: string, arm: string) {
  return [baseClassName.trim(), arm.trim()].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

export function inferBaseClassName(className: string, arm?: string) {
  const normalizedClassName = className.trim().replace(/\s+/g, " ");
  const normalizedArm = (arm ?? "").trim().replace(/\s+/g, " ");

  if (!normalizedClassName) {
    return "";
  }

  if (!normalizedArm) {
    return normalizedClassName;
  }

  const classNameLower = normalizedClassName.toLowerCase();
  const armLower = normalizedArm.toLowerCase();

  if (classNameLower === armLower) {
    return normalizedClassName;
  }

  if (classNameLower.endsWith(` ${armLower}`)) {
    return normalizedClassName.slice(0, normalizedClassName.length - normalizedArm.length).trim();
  }

  return normalizedClassName;
}

export function classOfferingLabel(offering: Pick<ClassOffering, "baseClassName" | "className" | "arm">) {
  return `${offering.baseClassName || inferBaseClassName(offering.className, offering.arm)} - ${offering.arm}`;
}
