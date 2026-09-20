import { describe, expect, it } from "vitest";
import {
  getCustomerTrackingSteps,
  getNextStatus,
  getStatusFlow,
  getStepIndex,
  LOCAL_DELIVERY_STATUS_FLOW,
  LOCAL_PICKUP_STATUS_FLOW,
  STATUS_FLOW,
} from "@/lib/order-status";

describe("order-status flows", () => {
  it("uses international STATUS_FLOW by default", () => {
    expect(getStatusFlow()).toEqual(STATUS_FLOW);
    expect(getStatusFlow("international")).toEqual(STATUS_FLOW);
  });

  it("local pickup omits freight and rider steps", () => {
    expect(getStatusFlow("local")).toEqual(LOCAL_PICKUP_STATUS_FLOW);
    expect(getStatusFlow("local", "hub_pickup")).toEqual(LOCAL_PICKUP_STATUS_FLOW);
    expect(getStatusFlow("local", null)).toEqual(LOCAL_PICKUP_STATUS_FLOW);
    expect(getStatusFlow("local")).not.toContain("in_shipping");
    expect(getStatusFlow("local")).not.toContain("assigning_rider");
  });

  it("local home_delivery uses rider last-mile steps", () => {
    expect(getStatusFlow("local", "home_delivery")).toEqual(LOCAL_DELIVERY_STATUS_FLOW);
    expect(getStatusFlow("local", "home_delivery")).toContain("out_for_delivery");
    expect(getStatusFlow("local", "home_delivery")).not.toContain("ready_for_pickup");
    expect(getStatusFlow("local", "home_delivery")).not.toContain("in_shipping");
  });

  it("getNextStatus and getStepIndex respect delivery choice", () => {
    expect(getNextStatus("preparing", "local", "hub_pickup")).toBe("ready_for_pickup");
    expect(getNextStatus("preparing", "local", "home_delivery")).toBe("assigning_rider");
    expect(getStepIndex("ready_for_pickup", "local", "hub_pickup")).toBe(3);
    expect(getStepIndex("out_for_delivery", "local", "home_delivery")).toBe(5);
  });

  it("getCustomerTrackingSteps length matches flow", () => {
    expect(getCustomerTrackingSteps("international").length).toBe(STATUS_FLOW.length);
    expect(getCustomerTrackingSteps("local", "hub_pickup").length).toBe(5);
    expect(getCustomerTrackingSteps("local", "home_delivery").length).toBe(7);
  });

  it("getStepIndex best-effort maps legacy statuses outside the active flow", () => {
    expect(getStepIndex("out_for_delivery", "local", "hub_pickup")).toBeGreaterThan(0);
    expect(getStepIndex("delivered", "local", "hub_pickup")).toBe(LOCAL_PICKUP_STATUS_FLOW.length - 1);
  });
});
