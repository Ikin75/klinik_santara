// js/satusehat-bridge.js

import { supabaseClient } from "./config.js";

export class SatusehatBridge {
  constructor() {
    this.token = null;
    this.clientId = null;
    this.clientSecret = null;
    this.orgId = null;

    // Auto-detect environment
    const isDev =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (isDev) {
      this.baseURL = "http://localhost:3001";
      this.authURL = "http://localhost:3001/oauth2/v1/accesstoken";
    } else {
      this.baseURL = "https://api-satusehat-stg.kemkes.go.id/fhir-r4/v1";
      this.authURL = "https://api-satusehat-stg.kemkes.go.id/oauth2/v1";
    }
  }

  async loadCredentials() {
    try {
      const clinicId =
        localStorage.getItem("clinic_id") || window.currentClinicId;
      if (!clinicId) return;

      const { data: clinic } = await supabaseClient
        .from("clinics")
        .select(
          "satusehat_client_id, satusehat_client_secret, satusehat_org_id",
        )
        .eq("id", clinicId)
        .single();

      if (clinic?.satusehat_client_id) {
        this.clientId = clinic.satusehat_client_id;
        this.clientSecret = clinic.satusehat_client_secret;
        this.orgId = clinic.satusehat_org_id;
        console.log("✅ SATUSEHAT credentials loaded");
      }
    } catch (err) {
      console.warn("⚠️ Gagal load credentials:", err.message);
    }
  }

  async getToken() {
    try {
      if (!this.clientId) await this.loadCredentials();

      const isDev = this.baseURL.includes("localhost");

      if (isDev) {
        // Mock server
        const body =
          "client_id=test&client_secret=test&grant_type=client_credentials";
        const response = await fetch(this.authURL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body,
        });
        const data = await response.json();
        this.token = data.access_token;
        console.log("✅ Token Mock didapat");
        return this.token;
      }

      // SATUSEHAT ASLI - Coba 2 cara:

      // CARA 1: Basic Auth
      console.log("🔐 Mencoba Basic Auth...");
      const basicAuth = btoa(`${this.clientId}:${this.clientSecret}`);

      let response = await fetch(this.authURL + "/accesstoken", {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      });

      if (response.ok) {
        const data = await response.json();
        this.token = data.access_token;
        console.log("✅ Token SATUSEHAT didapat (Basic Auth)");
        return this.token;
      }

      // CARA 2: POST body
      console.log("🔐 Mencoba POST body...");
      response = await fetch(this.authURL + "/accesstoken", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `client_id=${encodeURIComponent(this.clientId)}&client_secret=${encodeURIComponent(this.clientSecret)}&grant_type=client_credentials`,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gagal token: ${response.status} - ${errText}`);
      }

      const data = await response.json();
      this.token = data.access_token;
      console.log("✅ Token SATUSEHAT didapat (POST body)");
      return this.token;
    } catch (error) {
      console.error("❌ Gagal token:", error.message);
      throw error;
    }
  }

  async testConnection() {
    try {
      await this.getToken();
      console.log("✅ SATUSEHAT TERHUBUNG!");
      return { connected: true };
    } catch (error) {
      console.error("❌ SATUSEHAT OFFLINE:", error.message);
      return { connected: false, error: error.message };
    }
  }

  async registerPatient(patientData) {
    try {
      if (!this.token) await this.getToken();

      const fhirData = {
        resourceType: "Patient",
        active: true,
        identifier: [
          {
            system: "https://fhir.kemkes.go.id/id/nik",
            value: patientData.nik || "",
            use: "official",
          },
        ],
        name: [
          {
            use: "official",
            text: patientData.full_name || "",
          },
        ],
        gender:
          patientData.gender === "Laki-laki" || patientData.gender === "L"
            ? "male"
            : patientData.gender === "Perempuan" || patientData.gender === "P"
              ? "female"
              : "unknown",
        birthDate: patientData.birth_date || null,
        telecom: [
          ...(patientData.phone
            ? [{ system: "phone", value: patientData.phone, use: "mobile" }]
            : []),
        ],
        address: patientData.address
          ? [
              {
                use: "home",
                line: [patientData.address],
                country: "ID",
              },
            ]
          : [],
      };

      const response = await fetch(`${this.baseURL}/Patient`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(fhirData),
      });

      if (response.status === 401) {
        await this.getToken();
        return this.registerPatient(patientData);
      }

      if (!response.ok) {
        const err = await response.text();
        throw new Error(err);
      }

      const result = await response.json();
      return { success: true, ihsNumber: result.id };
    } catch (error) {
      console.error("❌ Gagal daftar pasien:", error.message);
      return { success: false, error: error.message };
    }
  }

  async sendEncounter(patientIHS, patientName, poli, complaint) {
    try {
      if (!this.token) await this.getToken();

      const fhirData = {
        resourceType: "Encounter",
        status: "planned",
        class: {
          system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
          code: "AMB",
          display: "ambulatory",
        },
        subject: {
          reference: `Patient/${patientIHS}`,
          display: patientName,
        },
        period: { start: new Date().toISOString() },
        reasonCode: [{ text: complaint || `Kunjungan ${poli}` }],
      };

      const response = await fetch(`${this.baseURL}/Encounter`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(fhirData),
      });

      if (!response.ok) throw new Error(await response.text());

      const result = await response.json();
      return { success: true, encounterIHS: result.id };
    } catch (error) {
      console.error("❌ Gagal kirim encounter:", error.message);
      return { success: false, error: error.message };
    }
  }

  async sendCondition(patientIHS, icd10Code, icd10Name) {
    try {
      if (!this.token) await this.getToken();

      const fhirData = {
        resourceType: "Condition",
        clinicalStatus: {
          coding: [
            {
              system:
                "http://terminology.hl7.org/CodeSystem/condition-clinical",
              code: "active",
            },
          ],
        },
        code: {
          coding: [
            {
              system: "http://hl7.org/fhir/sid/icd-10",
              code: icd10Code,
              display: icd10Name,
            },
          ],
          text: `${icd10Code} - ${icd10Name}`,
        },
        subject: { reference: `Patient/${patientIHS}` },
      };

      const response = await fetch(`${this.baseURL}/Condition`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(fhirData),
      });

      if (!response.ok) throw new Error(await response.text());

      const result = await response.json();
      return { success: true, conditionIHS: result.id };
    } catch (error) {
      console.error("❌ Gagal kirim diagnosa:", error.message);
      return { success: false, error: error.message };
    }
  }

  async sendMedicationRequest(patientIHS, medications) {
    try {
      if (!this.token) await this.getToken();

      const drugNames = medications
        .map((m) => `${m.drug_name} ${m.dose}`)
        .join(", ");

      const fhirData = {
        resourceType: "MedicationRequest",
        status: "active",
        intent: "order",
        medicationCodeableConcept: { text: drugNames },
        subject: { reference: `Patient/${patientIHS}` },
        authoredOn: new Date().toISOString(),
        dosageInstruction: medications.map((med, i) => ({
          sequence: i + 1,
          text: `${med.drug_name} - ${med.dose}`,
          doseAndRate: [
            { doseQuantity: { value: med.qty || 1, unit: "Tablet" } },
          ],
        })),
      };

      const response = await fetch(`${this.baseURL}/MedicationRequest`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(fhirData),
      });

      if (!response.ok) throw new Error(await response.text());

      const result = await response.json();
      return { success: true, medicationIHS: result.id };
    } catch (error) {
      console.error("❌ Gagal kirim resep:", error.message);
      return { success: false, error: error.message };
    }
  }
}

export const satusehatBridge = new SatusehatBridge();
