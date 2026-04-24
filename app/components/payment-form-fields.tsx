import {
  forwardRef,
  useImperativeHandle,
  useState,
} from "react";
import Select from "react-select";

import type { Member, Payment } from "../data/settlement";

type SelectOption = { label: string; value: string };
type SplitMode = "equal" | "shares";
type SplitModeOption = { label: string; value: SplitMode };

type PaymentFormErrors = {
  cost?: string;
  payer?: string;
  shareMember?: string;
  shareUnits?: string;
};

export type PaymentFormFieldsHandle = {
  validate: () => boolean;
};

type PaymentFormFieldsProps = {
  defaultDate?: string;
  members: Member[];
  payment?: Payment;
};

function getPaymentDate(payment?: Payment, defaultDate?: string) {
  if (payment?.createdAt) {
    return new Date(payment.createdAt).toISOString().slice(0, 10);
  }
  return defaultDate ?? new Date().toISOString().slice(0, 10);
}

function getInitialShareUnits(payment?: Payment) {
  const mapped: Record<string, number> = {};
  if (payment?.shareDetails?.length) {
    payment.shareDetails.forEach((item) => {
      mapped[item.member.uniqueId] = item.shares;
    });
  } else {
    payment?.shareMember.forEach((member) => {
      mapped[member.uniqueId] = 1;
    });
  }
  return mapped;
}

const PaymentFormFields = forwardRef<PaymentFormFieldsHandle, PaymentFormFieldsProps>(
  function PaymentFormFields(
    {
      defaultDate,
      members,
      payment,
    },
    ref
  ) {
    const splitModeOptions: SplitModeOption[] = [
      { label: "Equal", value: "equal" },
      { label: "By Shares", value: "shares" },
    ];
    const memberOptions: SelectOption[] = members.map((member) => ({
      label: member.name,
      value: member.uniqueId,
    }));
    const initialPayer =
      payment && memberOptions.find((option) => option.value === payment.payer.uniqueId);
    const initialShareMembers = payment
      ? payment.shareMember
          .map((member) => memberOptions.find((option) => option.value === member.uniqueId))
          .filter((option): option is SelectOption => option !== undefined)
      : [];

    const [selectedPayer, setSelectedPayer] = useState<SelectOption | null>(
      initialPayer ?? null
    );
    const [selectedShareMembers, setSelectedShareMembers] =
      useState<SelectOption[]>(initialShareMembers);
    const [splitMode, setSplitMode] = useState<SplitMode>(
      payment?.splitMode === "shares" ? "shares" : "equal"
    );
    const selectedSplitMode =
      splitModeOptions.find((option) => option.value === splitMode) ?? splitModeOptions[0];
    const [shareUnitsMap, setShareUnitsMap] =
      useState<Record<string, number>>(() => getInitialShareUnits(payment));
    const [formErrors, setFormErrors] = useState<PaymentFormErrors>({});
    const [paymentCostValue, setPaymentCostValue] = useState<string>(
      payment?.cost === undefined ? "" : String(payment.cost)
    );

    const validate = () => {
      const errors: PaymentFormErrors = {};
      const cost = Number(paymentCostValue);

      if (!Number.isFinite(cost) || cost <= 0) {
        errors.cost = "Cost must be greater than 0.";
      }
      if (!selectedPayer) {
        errors.payer = "Please select who paid for this payment.";
      }
      if (selectedShareMembers.length === 0) {
        errors.shareMember = "Please select at least one shared member.";
      }
      if (
        splitMode === "shares" &&
        selectedShareMembers.some((member) => {
          const units = Number(shareUnitsMap[member.value] ?? 0);
          return !Number.isFinite(units) || units <= 0 || !Number.isInteger(units);
        })
      ) {
        errors.shareUnits = "Each shared member must have integer shares greater than 0.";
      }

      setFormErrors(errors);
      return Object.keys(errors).length === 0;
    };

    useImperativeHandle(ref, () => ({ validate }));

    const getShareEstimate = (memberId: string) => {
      const totalCost = Number(paymentCostValue);
      if (!Number.isFinite(totalCost) || totalCost <= 0) {
        return 0;
      }
      const totalShares = selectedShareMembers.reduce(
        (sum, member) => sum + Math.max(1, Number(shareUnitsMap[member.value] ?? 1)),
        0
      );
      if (totalShares <= 0) {
        return 0;
      }
      const memberShares = Math.max(1, Number(shareUnitsMap[memberId] ?? 1));
      return (totalCost * memberShares) / totalShares;
    };

    const updateSelectedShareMembers = (selectedOptions: readonly SelectOption[] | null) => {
      const nextSelected = [...(selectedOptions ?? [])];
      setSelectedShareMembers(nextSelected);
      setShareUnitsMap((prev) => {
        const nextMap: Record<string, number> = {};
        nextSelected.forEach((item) => {
          nextMap[item.value] = prev[item.value] ?? 1;
        });
        return nextMap;
      });
      if (formErrors.shareMember || formErrors.shareUnits) {
        setFormErrors((prev) => ({
          ...prev,
          shareMember: undefined,
          shareUnits: undefined,
        }));
      }
    };

    const adjustShares = (memberId: string, delta: number) => {
      setShareUnitsMap((prev) => ({
        ...prev,
        [memberId]: Math.max(1, (prev[memberId] ?? 1) + delta),
      }));
      if (formErrors.shareUnits) {
        setFormErrors((prev) => ({ ...prev, shareUnits: undefined }));
      }
    };

    return (
      <>
        <p>
          <span>Name</span>
          <input
            aria-label="Name"
            defaultValue={payment?.name ?? ""}
            name="name"
            placeholder="Name"
            type="text"
            required
          />
        </p>
        <p>
          <span>Cost</span>
          <input
            aria-label="Cost"
            min={0}
            name="cost"
            onChange={(event) => setPaymentCostValue(event.target.value)}
            placeholder="Enter amount"
            step="0.01"
            type="number"
            value={paymentCostValue}
            required
          />
        </p>
        {formErrors.cost ? <p className="field-error">{formErrors.cost}</p> : null}
        <p>
          <span>Date</span>
          <input
            aria-label="Date"
            defaultValue={getPaymentDate(payment, defaultDate)}
            name="createdAt"
            type="date"
            required
          />
        </p>
        <p>
          <span>Paid By</span>
          <Select
            name="payer"
            options={memberOptions}
            classNamePrefix="rs"
            value={selectedPayer}
            onChange={(option) => {
              setSelectedPayer(option as SelectOption | null);
              if (formErrors.payer) {
                setFormErrors((prev) => ({ ...prev, payer: undefined }));
              }
            }}
          />
        </p>
        {formErrors.payer ? <p className="field-error">{formErrors.payer}</p> : null}
        <p>
          <span>Split Mode</span>
          <Select
            name="splitMode"
            options={splitModeOptions}
            classNamePrefix="rs"
            value={selectedSplitMode}
            onChange={(option) => setSplitMode(option?.value ?? "equal")}
            isSearchable={false}
          />
        </p>
        <p>
          <span>Shared By</span>
          <Select
            options={memberOptions}
            classNamePrefix="rs"
            value={selectedShareMembers}
            onChange={updateSelectedShareMembers}
            isMulti
          />
        </p>
        {formErrors.shareMember ? (
          <p className="field-error">{formErrors.shareMember}</p>
        ) : null}
        {splitMode === "shares" && selectedShareMembers.length ? (
          <div className="share-units-list">
            {selectedShareMembers.map((member) => (
              <p key={member.value}>
                <span>{member.label} shares</span>
                <div className="share-stepper">
                  <button
                    className="share-stepper-btn"
                    onClick={() => adjustShares(member.value, -1)}
                    type="button"
                  >
                    -
                  </button>
                  <input
                    className="share-stepper-value"
                    name={`shareUnits:${member.value}`}
                    readOnly
                    type="number"
                    value={shareUnitsMap[member.value] ?? 1}
                  />
                  <button
                    className="share-stepper-btn"
                    onClick={() => adjustShares(member.value, 1)}
                    type="button"
                  >
                    +
                  </button>
                </div>
                <span className="share-estimate">
                  ${getShareEstimate(member.value).toFixed(2)}
                </span>
              </p>
            ))}
          </div>
        ) : null}
        {selectedShareMembers.map((member) => (
          <input key={member.value} name="shareMember" type="hidden" value={member.value} />
        ))}
        {formErrors.shareUnits ? (
          <p className="field-error">{formErrors.shareUnits}</p>
        ) : null}
      </>
    );
  }
);

export default PaymentFormFields;
