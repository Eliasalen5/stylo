"use client";

import { useActionState } from "react";
import { createAppointment, type AppointmentState } from "@/app/actions/appointments";
import { BookingWizard, type WizardProfessional, type WizardService, type WizardCustomer } from "@/components/appointments/booking-wizard";

const initialState: AppointmentState = {};

export function NewAppointmentWizard({
  professionals,
  services,
  customers,
}: {
  professionals: WizardProfessional[];
  services: WizardService[];
  customers: WizardCustomer[];
}) {
  const [state, formAction, isPending] = useActionState(
    createAppointment,
    initialState
  );

  return (
    <BookingWizard
      professionals={professionals}
      services={services}
      customers={customers}
      state={state}
      isPending={isPending}
      formAction={formAction}
    />
  );
}