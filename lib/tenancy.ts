export type Role = "owner" | "manager" | "staff_admin" | "staff_support";

const STAFF: Role[] = ["staff_admin", "staff_support"];

export const isStaffRole = (role: Role): boolean => STAFF.includes(role);
export const isCustomerRole = (role: Role): boolean => !isStaffRole(role);
export const landingFor = (role: Role): string => (isStaffRole(role) ? "/admin" : "/my-odatone");
