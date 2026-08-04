/**
 * Portals and modals (§20.2). Two of them, so "the portal escaped into the host
 * document" and "only one portal rendered" are distinguishable failures.
 */
import { Modal } from "../components/Modal.tsx";

export default {
	Single: <Modal title="Single modal">body one</Modal>,
	Stacked: (
		<>
			<Modal title="Outer modal">outer</Modal>
			<Modal title="Inner modal">inner</Modal>
		</>
	),
};
